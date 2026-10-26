import { useMemo } from "react"
import { useChatDraft } from "@/components/chat/ChatDraftContext"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { useSettings } from "@/hooks/useSettings"
import type { VideoState } from "@/hooks/useVideo"
import { formatTranscriptForPrompt } from "@/lib/prompts/transcript-text"
import { PROVIDERS } from "@/lib/providers"
import { DEFAULT_SETTINGS } from "@/lib/storage"
import { summaryForCopy } from "@/lib/summary/parse"
import { SUMMARY_STYLES } from "@/lib/summary/styles"
import type { ProviderId } from "@/lib/types"
import { NoCaptions } from "./NoCaptions"
import { useSummaryContext } from "./SummaryContext"
import { SummaryDone } from "./SummaryDone"
import { SummaryError } from "./SummaryError"
import { SummaryIdle } from "./SummaryIdle"
import { SummaryLoading } from "./SummaryLoading"

function modelLabel(provider: ProviderId, id: string): string {
  return PROVIDERS[provider].models.find((m) => m.id === id)?.label ?? id
}

export function SummaryPanel({ video }: { video: VideoState }) {
  const summary = useSummaryContext()
  const { status, text, parsed, receivedFirstToken, error, style, stored, generate } = summary
  const [storedSettings] = useSettings()
  const settings = storedSettings ?? DEFAULT_SETTINGS
  const { selectTab, setOptionsOpen } = usePanelNav()
  const { setDraft, requestFocus } = useChatDraft()
  const toast = useToast()
  const { transcript, context } = video
  const provider = settings.provider
  const currentModel = settings.models[provider]

  const chars = useMemo(
    () => (context ? formatTranscriptForPrompt(context.transcript).length : 0),
    [context],
  )

  const body = (() => {
    if (transcript.state === "unavailable") return <NoCaptions variant="summary" />
    if (transcript.state === "error") {
      return (
        <SummaryError
          title="Couldn't load the transcript"
          message={transcript.message}
          hint="Retry, or try another video."
          onRetry={video.reload}
        />
      )
    }
    if (status === "error") {
      return (
        <SummaryError
          providerLabel={PROVIDERS[provider].label}
          message={error ?? "Something went wrong."}
          onRetry={() => generate({ force: true })}
          onSwitchModel={() => setOptionsOpen(true)}
        />
      )
    }
    if (!context || (status === "streaming" && !receivedFirstToken)) {
      return (
        <SummaryLoading step={context ? 1 : 0} segmentCount={context?.transcript.length ?? 0} />
      )
    }
    if ((status === "streaming" || status === "done") && text) {
      const firstMoment = parsed.moments[0]
      // A restored summary may come from another model than the one now selected.
      const model = status === "done" && stored ? stored.model : currentModel
      const language =
        settings.language === "match" ? context.language.toUpperCase() : settings.language
      return (
        <SummaryDone
          parsed={parsed}
          style={style}
          feedback={summary.feedback}
          onFeedback={(f) => {
            summary.setFeedback(f)
            toast("Thanks, noted")
          }}
          onCopy={() => {
            navigator.clipboard.writeText(summaryForCopy(text)).then(
              () => toast("Copied as Markdown"),
              () => toast("Couldn't copy"),
            )
          }}
          onFollowUp={() => {
            setDraft(
              firstMoment
                ? `Explain ${firstMoment.text} in more detail`
                : "Tell me more about this video",
            )
            selectTab("chat")
            requestFocus()
          }}
          meta={`${modelLabel(provider, model)} · ${SUMMARY_STYLES[style].label} · ${language}`}
        />
      )
    }
    return (
      <SummaryIdle
        segments={context.transcript.length}
        durationSeconds={context.metadata.durationSeconds}
        chars={chars}
        modelLabel={modelLabel(provider, currentModel)}
        showAutoHint={!settings.autoSummarize}
        onGenerate={() => generate()}
        onChat={() => selectTab("chat")}
      />
    )
  })()

  return <div className="p-[16px]">{body}</div>
}
