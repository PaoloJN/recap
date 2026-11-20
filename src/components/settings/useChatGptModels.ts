import { useEffect, useState } from "react"
import { requestChatGptModels } from "@/lib/chatgpt/client"
import type { ChatGptModel } from "@/lib/chatgpt/models"

export function useChatGptModels(enabled: boolean): { loaded: boolean; models: ChatGptModel[] } {
  const [state, setState] = useState<{ loaded: boolean; models: ChatGptModel[] }>({
    loaded: !enabled,
    models: [],
  })

  useEffect(() => {
    if (!enabled) {
      setState({ loaded: true, models: [] })
      return
    }
    let active = true
    setState({ loaded: false, models: [] })
    void requestChatGptModels().then((result) => {
      if (!active) return
      setState({ loaded: true, models: result.ok ? result.models : [] })
    })
    return () => {
      active = false
    }
  }, [enabled])

  return state
}
