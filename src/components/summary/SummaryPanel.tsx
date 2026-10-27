import { WarningCircle } from "@phosphor-icons/react"
import { useMemo } from "react"
import { useChatDraft } from "@/components/chat/ChatDraftContext"
import { gateFor, inlineErrorCopy } from "@/components/pro/access"
import { ProErrorGate } from "@/components/pro/ProErrorGate"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { useSettings } from "@/hooks/useSettings"
import type { VideoState } from "@/hooks/useVideo"
import { formatTranscriptForPrompt } from "@/lib/prompts/transcript-text"
import { isByok, PROVIDERS } from "@/lib/providers"
import { DEFAULT_SETTINGS } from "@/lib/storage"
import { summaryForCopy } from "@/lib/summary/parse"
import { SUMMARY_STYLES } from "@/lib/summary/styles"
import type { ProviderId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { primaryButton, smallButton } from "./buttons"
import { NoCaptions } from "./NoCaptions"
import { useSummaryContext } from "./SummaryContext"
import { SummaryDone } from "./SummaryDone"
import { SummaryError } from "./SummaryError"
import { SummaryIdle } from "./SummaryIdle"
import { SummaryLoading } from "./SummaryLoading"

/** A failure after part of the summary arrived: the partial text stays, this sits above it. */
function PartialError({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className="mb-[16px] flex items-center gap-[8px] rounded-[12px] bg-danger-soft p-[12px]">
      <WarningCircle weight="fill" className="size-[16px] shrink-0 text-destructive" aria-hidden />
      <span
        role="alert"
        className="min-w-0 flex-1 text-[13px] leading-[19px] break-words text-foreground"
      >
        {message}
      </span>
      <button type="button" className={cn(primaryButton, smallButton)} onClick={onRetry}>
        Retry now
      </button>
    </div>
  )
}

function modelLabel(provider: ProviderId, id: string): string {
  return PROVIDERS[provider].models.find((m) => m.id === id)?.label ?? id
}

export function SummaryPanel({ video }: { video: VideoState }) {
  const summary = useSummaryContext()
  const {
    status,
    text,
    parsed,
    receivedFirstToken,
    error,
    errorCode,
    resetsAt,
    clearError,
    style,
    stored,
    generate,
  } = summary
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

  const errorMessage = error ?? "Something went wrong."
  // Upgrade, limit and signed-out errors replace the body, unless part of the summary arrived.
  const gate = status === "error" && !text ? gateFor(errorCode ?? undefined) : null
  if (gate && transcript.state === "ready") {
    return <ProErrorGate gate={gate} kind="summary" resetsAt={resetsAt} onUpgraded={clearError} />
  }

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
    // With partial text the error is a banner over it (below); otherwise it replaces the body.
    if (status === "error" && !text) {
      const byok = isByok(provider)
      return (
        <SummaryError
          providerLabel={PROVIDERS[provider].label}
          message={inlineErrorCopy(errorCode ?? undefined, "summary", !byok) ?? errorMessage}
          hint={byok ? undefined : ""}
          onRetry={() => generate({ force: true })}
          onSwitchModel={byok ? () => setOptionsOpen(true) : undefined}
        />
      )
    }
    if (!context || (status === "streaming" && !receivedFirstToken)) {
      return (
        <SummaryLoading step={context ? 1 : 0} segmentCount={context?.transcript.length ?? 0} />
      )
    }
    if ((status === "streaming" || status === "done" || status === "error") && text) {
      const firstMoment = parsed.moments[0]
      // A restored summary may come from another model than the one now selected.
      const model = status === "done" && stored ? stored.model : currentModel
      const language =
        settings.language === "match" ? context.language.toUpperCase() : settings.language
      const done = (
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
      if (status !== "error") return done
      return (
        <>
          <PartialError
            message={
              inlineErrorCopy(errorCode ?? undefined, "summary", !isByok(provider)) ?? errorMessage
            }
            onRetry={() => generate({ force: true })}
          />
          {done}
        </>
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
