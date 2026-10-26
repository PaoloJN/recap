import { NotePencil } from "@phosphor-icons/react"
import { useChatDraft } from "./ChatDraftContext"

/** Tab-row action on the Chat tab: clears the thread. Panel shows it only when there are messages. */
export function NewChatButton() {
  const { requestNewChat } = useChatDraft()
  return (
    <button
      type="button"
      onClick={requestNewChat}
      className="flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] px-[10px] text-[13px] font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <NotePencil className="size-[16px]" aria-hidden />
      New
    </button>
  )
}
