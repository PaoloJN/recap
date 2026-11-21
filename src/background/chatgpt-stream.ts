import type { UIMessageChunk } from "ai"
import { CHATGPT_RESPONSES_URL } from "@/lib/chatgpt/constants"
import { friendlyChatGptError } from "@/lib/chatgpt/errors"
import { omitReasoning, type ResponsesBody, responsesBodyForRequest } from "@/lib/chatgpt/request"
import { readResponsesSse } from "@/lib/chatgpt/sse"
import type { StreamPortMessage, StreamRequest } from "@/lib/port-protocol"
import { isReasoningRejection, REASONING_NOTE } from "@/lib/reasoning"
import { isWebToolRejection, WEB_NOTE, withoutWeb } from "@/lib/tutor/web"
import { authorizedFetch } from "./chatgpt-auth"

function failureMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err && err.name === "AbortError") {
    return "Stopped."
  }
  if (err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"))) {
    return "Network error reaching the provider."
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong."
}

const TEXT_ID = "chatgpt"

interface ChatGptStreamDeps {
  post: (message: StreamPortMessage) => void
  signal: AbortSignal
  recordUsage?: (kind: StreamRequest["kind"], tokens: number) => Promise<void>
}

async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const json = (await res.json()) as { error?: { code?: string } }
    return json.error?.code
  } catch {
    return undefined
  }
}

function chunk(part: UIMessageChunk): StreamPortMessage {
  return { type: "chunk", chunk: part }
}

async function postResponses(body: ResponsesBody, signal: AbortSignal): Promise<Response> {
  return authorizedFetch(CHATGPT_RESPONSES_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  })
}

/** One retry drops a rejected `reasoning` or `web_search` field. The note is shown on the answer. */
async function responsesWithFallback(
  req: StreamRequest,
  signal: AbortSignal,
): Promise<{ res: Response; note: string }> {
  let next = responsesBodyForRequest(req)
  let res = await postResponses(next, signal)
  if (res.ok) return { res, note: "" }
  const text = await res.text()
  const reasoning = Boolean(next.reasoning) && isReasoningRejection(res.status, text)
  const web = Boolean(next.tools) && isWebToolRejection(res.status, text)
  if (!reasoning && !web) throw new Error(friendlyChatGptError(undefined, res.status) || text)
  const notes: string[] = []
  if (web) {
    // Rebuilt, not just stripped: the chat instructions also change once web search is off.
    next = responsesBodyForRequest(withoutWeb(req))
    notes.push(WEB_NOTE)
  }
  if (reasoning) {
    next = omitReasoning(next)
    notes.push(REASONING_NOTE)
  }
  res = await postResponses(next, signal)
  if (!res.ok || !res.body) {
    throw new Error(friendlyChatGptError(res.ok ? undefined : await errorCode(res), res.status))
  }
  return { res, note: notes.join("\n\n") }
}

/** Summary, diagram, chat, and tutor tasks all go through one Responses request. */
export async function runChatGptRequest(
  req: StreamRequest,
  deps: ChatGptStreamDeps,
): Promise<void> {
  const { post, signal } = deps
  try {
    const { res, note } = await responsesWithFallback(req, signal)
    if (!res.body) throw new Error(friendlyChatGptError(undefined, res.status))
    let started = false
    const tokens = await readResponsesSse(res.body, (delta) => {
      if (signal.aborted) return
      if (!started) {
        post(chunk({ type: "text-start", id: TEXT_ID }))
        started = true
      }
      post(chunk({ type: "text-delta", id: TEXT_ID, delta }))
    })
    if (signal.aborted) {
      post({ type: "error", message: "Stopped." })
      return
    }
    if (note) {
      if (!started) {
        post(chunk({ type: "text-start", id: TEXT_ID }))
        started = true
      }
      post(chunk({ type: "text-delta", id: TEXT_ID, delta: `\n\n${note}` }))
    }
    if (started) post(chunk({ type: "text-end", id: TEXT_ID }))
    if (deps.recordUsage) {
      try {
        await deps.recordUsage(req.kind, tokens)
      } catch (err) {
        console.error("Failed to record usage", err)
      }
    }
    post({ type: "done" })
  } catch (err) {
    if (signal.aborted) {
      post({ type: "error", message: "Stopped." })
      return
    }
    post({ type: "error", message: failureMessage(err) })
  }
}
