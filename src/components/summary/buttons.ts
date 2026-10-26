/** Shared button looks for the summary views (prototype: accent primary, overlay secondary). */
const BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-[8px] rounded-[8px] font-medium whitespace-nowrap transition-colors duration-150 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[16px] [&_svg]:shrink-0"

export const primaryButton = `${BASE} bg-primary text-primary-foreground hover:bg-primary/90`
export const secondaryButton = `${BASE} bg-secondary text-foreground hover:bg-muted`
/** 36px, 14px label. */
export const largeButton = "h-[36px] px-[16px] text-[14px]"
/** 32px, 13px label. */
export const smallButton = "h-[32px] px-[14px] text-[13px]"
