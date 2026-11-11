import { ChatCircle, Key, ListMagnifyingGlass, PushPin, Sparkle } from "@phosphor-icons/react"

const YOUTUBE_URL = "https://www.youtube.com/"

export interface WelcomeProps {
  /** Toggle shortcut as shown to the user. */
  shortcut: string
  /** Whether this build offers Recap Pro. */
  pro: boolean
  iconUrl: string
}

export function Welcome({ shortcut, pro, iconUrl }: WelcomeProps) {
  const steps = [
    {
      icon: ListMagnifyingGlass,
      title: "Open any YouTube video",
      note: `The Recap panel sits above the related videos. Press ${shortcut} to show or hide it.`,
    },
    pro
      ? {
          icon: Sparkle,
          title: "Sign in for 20 free summaries",
          note: "No key, no setup. Or add your own OpenAI, Anthropic, Google or OpenRouter key.",
        }
      : {
          icon: Key,
          title: "Add your API key",
          note: "OpenAI, Anthropic, Google or OpenRouter. It stays in your browser.",
        },
    {
      icon: ChatCircle,
      title: "Summarize, search, ask",
      note: "Key moments you can click, a searchable transcript and chat about the video.",
    },
  ]
  return (
    <main className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="mx-auto flex max-w-[520px] flex-col gap-[32px] px-[24px] py-[64px]">
        <header className="flex flex-col gap-[16px]">
          <img src={iconUrl} alt="" width={56} height={56} className="size-[56px] rounded-[14px]" />
          <div className="flex flex-col gap-[6px]">
            <h1 className="text-[26px] leading-[32px] font-medium">Recap is installed</h1>
            <p className="text-[15px] leading-[22px] text-muted-foreground">
              Three steps and you're summarizing.
            </p>
          </div>
        </header>
        <ol className="divide-y divide-border overflow-hidden rounded-[12px] bg-card">
          {steps.map(({ icon: Icon, title, note }, i) => (
            <li key={title} className="flex gap-[14px] px-[16px] py-[14px]">
              <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-medium">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-[2px]">
                <span className="flex items-center gap-[6px] text-[15px] leading-[22px] font-medium">
                  <Icon size={16} className="text-muted-foreground" aria-hidden />
                  {title}
                </span>
                <span className="text-[14px] leading-[20px] text-muted-foreground">{note}</span>
              </div>
            </li>
          ))}
        </ol>
        <a
          href={YOUTUBE_URL}
          className="inline-flex h-[40px] items-center justify-center rounded-[8px] bg-primary px-[18px] text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open YouTube
        </a>
        <p className="flex items-center gap-[8px] text-[13px] leading-[18px] text-subtle-foreground">
          <PushPin size={14} aria-hidden />
          Tip: pin Recap from the extensions menu to see it in the toolbar.
        </p>
      </div>
    </main>
  )
}
