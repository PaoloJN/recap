import { ArrowLeft, CircleNotch, HardDrives, LockSimple, Trash } from "@phosphor-icons/react"
import { RadioGroup } from "radix-ui"
import { useState } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { largeButton, primaryButton } from "@/components/summary/buttons"
import { useSettings } from "@/hooks/useSettings"
import { PROVIDER_IDS, PROVIDERS } from "@/lib/providers"
import { apiKeysItem } from "@/lib/storage"
import type { ProviderId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { KeyField, type KeyFieldState } from "./KeyField"
import { useKeyCheck } from "./useKeyCheck"

const FOOTER = [
  { icon: HardDrives, text: "Stored in chrome.storage on this device" },
  { icon: LockSimple, text: "Never sent to my server — there isn't one" },
  { icon: Trash, text: "Remove it anytime in settings" },
]

export function ConnectView({ initialProvider }: { initialProvider: ProviderId }) {
  const { setView } = usePanelNav()
  const toast = useToast()
  const [, updateSettings] = useSettings()
  const [provider, setProvider] = useState(initialProvider)
  const [key, setKey] = useState("")
  const [show, setShow] = useState(false)
  const { status, result, error, check, reset } = useKeyCheck()
  const info = PROVIDERS[provider]

  const edit = (next: string) => {
    setKey(next)
    if (status !== "idle" || error) reset()
  }

  const save = async () => {
    const keys = await apiKeysItem.getValue()
    await apiKeysItem.setValue({ ...keys, [provider]: key.trim() })
    await updateSettings({ provider })
    setView("main")
    toast(`Connected to ${info.label}`)
  }

  const submit = () => {
    if (status === "checking") return
    if (status === "valid") void save()
    else void check(provider, key)
  }

  const fieldState: KeyFieldState = error ? "error" : status
  const models = result?.ok ? result.models : []
  const matched = info.models.filter((m) => models.includes(m.id))
  const chips = matched.length > 0 ? matched : info.models
  const buttonLabel = {
    idle: "Test key",
    checking: "Checking…",
    invalid: "Test again",
    valid: "Save and continue",
  }[status]

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="px-[8px] pt-[4px]">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setView("main")}
          className="flex size-[36px] cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-[20px] p-[16px]">
        <div className="flex flex-col gap-[6px]">
          <h2 className="text-[18px] leading-[24px] font-medium text-foreground">
            Connect your API key
          </h2>
          <p className="text-[14px] leading-[21px] text-muted-foreground">
            Pick a provider and paste a key. It's stored in Chrome on this device and only sent to
            that provider.
          </p>
        </div>

        <div className="flex flex-col gap-[8px]">
          <span id="provider-label" className="text-[13px] font-medium text-muted-foreground">
            Provider
          </span>
          <RadioGroup.Root
            aria-labelledby="provider-label"
            value={provider}
            onValueChange={(v) => {
              setProvider(v as ProviderId)
              reset()
            }}
            className="divide-y divide-border overflow-hidden rounded-[12px] bg-card"
          >
            {PROVIDER_IDS.map((id) => {
              const p = PROVIDERS[id]
              return (
                <RadioGroup.Item
                  key={id}
                  value={id}
                  className="flex w-full cursor-pointer items-center gap-[12px] px-[14px] py-[12px] text-left outline-none focus-visible:bg-secondary"
                >
                  <span
                    className={cn(
                      "size-[16px] shrink-0 rounded-full",
                      provider === id
                        ? "border-[5px] border-foreground"
                        : "border-[1.5px] border-subtle-foreground",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="text-[14px] leading-[20px] font-medium text-foreground">
                      {p.label}
                    </span>
                    <span className="truncate text-[12px] leading-[16px] text-muted-foreground">
                      {p.tagline}
                    </span>
                  </span>
                  {p.tag ? (
                    <span className="shrink-0 text-[11px] text-subtle-foreground">{p.tag}</span>
                  ) : null}
                </RadioGroup.Item>
              )
            })}
          </RadioGroup.Root>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted-foreground">
              {info.label} API key
            </span>
            <a
              href={info.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-link hover:underline"
            >
              Get a key ↗
            </a>
          </div>
          <KeyField
            provider={provider}
            value={key}
            onChange={edit}
            show={show}
            onToggleShow={() => setShow((s) => !s)}
            onPaste={edit}
            onSubmit={submit}
            state={fieldState}
          />
          {error ? <p className="text-[12px] text-destructive">Paste a key first.</p> : null}
          {status === "checking" ? (
            <p className="flex items-center gap-[6px] text-[12px] text-muted-foreground">
              <CircleNotch size={14} className="animate-spin" aria-hidden />
              Checking with {info.label}…
            </p>
          ) : null}
          {status === "invalid" && result && !result.ok ? (
            <div
              role="alert"
              className="flex flex-col gap-[4px] rounded-[12px] bg-danger-soft p-[12px]"
            >
              <span className="text-[14px] leading-[20px] font-medium text-foreground">
                {result.message}
              </span>
              <span className="text-[12px] leading-[18px] text-muted-foreground">
                {result.status === null
                  ? "Check your connection and try again."
                  : "Check it's copied in full and billing is on for that project."}
              </span>
            </div>
          ) : null}
          {status === "valid" ? (
            <div className="flex flex-col gap-[8px] rounded-[12px] bg-success-soft p-[12px]">
              <span className="text-[14px] leading-[20px] font-medium text-foreground">
                {models.length > 0 ? `Key works. ${models.length} models available.` : "Key works."}
              </span>
              <div className="flex flex-wrap gap-[6px]">
                {chips.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex h-[24px] items-center rounded-[6px] bg-secondary px-[8px] text-[12px] text-foreground"
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={status === "checking"}
          onClick={submit}
          className={cn(primaryButton, largeButton, "h-[40px] w-full")}
        >
          {buttonLabel}
        </button>

        <div className="flex flex-col gap-[8px]">
          {FOOTER.map(({ icon: FooterIcon, text }) => (
            <div
              key={text}
              className="flex items-center gap-[8px] text-[12px] leading-[16px] text-muted-foreground"
            >
              <FooterIcon size={16} className="shrink-0 text-subtle-foreground" aria-hidden />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
