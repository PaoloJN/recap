import { ToggleGroup } from "radix-ui"
import { cn } from "@/lib/utils"

export interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange(value: T): void
  itemClassName?: string
}

/** Single-select segmented control (shadcn ToggleGroup look per the prototype `seg`). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  itemClassName,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      // Radix emits "" when the selected item is clicked again; never allow an empty value.
      onValueChange={(v) => {
        if (v) onChange(v as T)
      }}
      className="flex gap-[2px] rounded-[8px] bg-secondary p-[2px]"
    >
      {options.map(([id, text]) => (
        <ToggleGroup.Item
          key={id}
          value={id}
          className={cn(
            "h-[28px] cursor-pointer rounded-[6px] px-[12px] text-[12px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
            itemClassName,
          )}
        >
          {text}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
