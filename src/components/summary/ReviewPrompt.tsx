import { Star } from "@phosphor-icons/react"
import { browser } from "wxt/browser"
import { useStorageItem } from "@/hooks/useStorageItem"
import { reviewItem, settleReview, shouldAskForReview } from "@/lib/review"
import { reviewUrl } from "@/lib/site"
import { cn } from "@/lib/utils"
import { primaryButton, secondaryButton, smallButton } from "./buttons"

/**
 * One-time ask under a finished summary, after the third one. Either answer settles it for good.
 * Chrome only: Firefox has no review URL we can derive.
 */
export function ReviewPrompt({
  storeUrl = reviewUrl(browser.runtime.id, import.meta.env.FIREFOX),
}: {
  storeUrl?: string | null
}) {
  const [state, setState] = useStorageItem(reviewItem)
  if (!storeUrl || !shouldAskForReview(state)) return null
  const settle = () => {
    if (state) void setState(settleReview(state))
  }
  return (
    <section
      aria-label="Rate Recap"
      className="flex flex-col gap-[10px] rounded-[12px] bg-card px-[14px] py-[12px]"
    >
      <div className="flex items-start gap-[10px]">
        <Star weight="fill" className="mt-[2px] size-[16px] shrink-0 text-warning" aria-hidden />
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="text-[14px] leading-[20px] font-medium text-foreground">
            Enjoying Recap?
          </span>
          <span className="text-[13px] leading-[18px] text-muted-foreground">
            A quick review on the Chrome Web Store helps others find it.
          </span>
        </div>
      </div>
      <div className="flex gap-[8px]">
        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(primaryButton, smallButton)}
          onClick={settle}
        >
          Rate it
        </a>
        <button type="button" className={cn(secondaryButton, smallButton)} onClick={settle}>
          Not now
        </button>
      </div>
    </section>
  )
}
