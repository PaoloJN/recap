import { useState } from "react"
import { SMALL_BUTTON } from "@/components/settings/styles"
import { useToast } from "@/components/shell/ToastContext"
import { useStorageItem } from "@/hooks/useStorageItem"
import { requestChatGptLogin, requestChatGptLogout } from "@/lib/chatgpt/client"
import { chatgptSessionItem } from "@/lib/storage"
import { cn } from "@/lib/utils"

export function useChatGptSignedIn(): boolean {
  const [session] = useStorageItem(chatgptSessionItem)
  return Boolean(session?.signedIn)
}

/** Sign-in state plus the two account buttons. Tokens never reach this component. */
export function ChatGptAuthButtons({ onLogin }: { onLogin?: () => void | Promise<void> }) {
  const toast = useToast()
  const [session] = useStorageItem(chatgptSessionItem)
  const signedIn = Boolean(session?.signedIn)
  const message = session?.message ?? ""
  const [busy, setBusy] = useState(false)
  const ghost = cn(SMALL_BUTTON, "px-[10px] hover:bg-secondary")

  const login = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await requestChatGptLogin()
      if (result.ok) {
        toast("Đã đăng nhập ChatGPT")
        await onLogin?.()
      } else toast(result.message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await requestChatGptLogout()
      toast("Đã đăng xuất ChatGPT")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-[6px]">
      {signedIn ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void logout()}
          className={cn(ghost, "text-destructive")}
        >
          Đăng xuất
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void login()}
          className={cn(SMALL_BUTTON, "bg-secondary text-foreground hover:bg-muted")}
        >
          {busy ? "Đang đăng nhập…" : "Đăng nhập ChatGPT"}
        </button>
      )}
      {message ? (
        <span className="max-w-[220px] text-right text-[12px] text-destructive">{message}</span>
      ) : null}
    </div>
  )
}

export function chatGptStatus(signedIn: boolean): string {
  return signedIn ? "Đã đăng nhập" : "Chưa đăng nhập"
}
