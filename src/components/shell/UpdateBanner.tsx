export function UpdateBanner({ version, onDismiss }: { version: string; onDismiss(): void }) {
  const label = version.replace(/^v/i, "")
  return (
    <div
      data-testid="update-banner"
      className="flex items-start gap-[8px] border-b bg-muted px-[12px] py-[8px] text-[12px] leading-[16px] text-foreground"
    >
      <p className="min-w-0 flex-1">
        Có bản mới v{label} — chạy recap-update hoặc đợi 8h sáng, rồi Reload ở chrome://extensions
      </p>
      <button
        type="button"
        className="shrink-0 text-muted-foreground underline-offset-2 hover:underline"
        onClick={onDismiss}
      >
        Đóng
      </button>
    </div>
  )
}
