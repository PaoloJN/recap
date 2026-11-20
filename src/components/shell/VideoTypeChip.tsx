import { VIDEO_TYPE_LABELS, VIDEO_TYPES, type VideoType } from "@/lib/prompts/video-type"

export function VideoTypeChip({
  type,
  pending,
  onPick,
}: {
  type: VideoType | null
  pending: boolean
  onPick(type: VideoType): void
}) {
  return (
    <div className="px-[16px] pt-[2px] pb-[8px]">
      <label
        data-testid="video-type-chip"
        className="inline-flex h-[24px] max-w-full items-center gap-[4px] rounded-full border bg-background px-[8px] text-[12px] leading-[16px] text-foreground"
      >
        <span className="shrink-0">Loại:</span>
        <select
          aria-label="Loại video"
          className="max-w-[180px] truncate bg-transparent text-[12px] outline-none disabled:text-muted-foreground"
          value={type ?? ""}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value as VideoType
            if (next && next !== type) onPick(next)
          }}
        >
          {pending ? <option value={type ?? ""}>Đang nhận diện…</option> : null}
          {type === null && !pending ? <option value="">Tự chọn</option> : null}
          {VIDEO_TYPES.map((id) => (
            <option key={id} value={id}>
              {VIDEO_TYPE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
