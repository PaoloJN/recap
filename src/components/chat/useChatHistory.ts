import type { UIMessage } from "ai"
import { useCallback } from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import { chatsItem, removeChat, upsertChat } from "@/lib/storage"

export interface ChatHistory {
  initialMessages: UIMessage[] | undefined
  ready: boolean
  save(messages: UIMessage[], title?: string): Promise<void>
  clear(): Promise<void>
}

export function useChatHistory(videoId: string): ChatHistory {
  const [store] = useStorageItem(chatsItem)

  const save = useCallback(
    (messages: UIMessage[], title?: string) =>
      chatsItem
        .getValue()
        .then((s) => chatsItem.setValue(upsertChat(s, videoId, messages, Date.now(), title))),
    [videoId],
  )

  const clear = useCallback(
    () => chatsItem.getValue().then((s) => chatsItem.setValue(removeChat(s, videoId))),
    [videoId],
  )

  return {
    initialMessages: store?.[videoId]?.messages,
    ready: store !== undefined,
    save,
    clear,
  }
}
