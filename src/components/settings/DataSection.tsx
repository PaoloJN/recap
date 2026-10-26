import { useToast } from "@/components/shell/ToastContext"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { downloadText } from "@/lib/download"
import { exportAllChats } from "@/lib/export"
import { chatsItem } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { SettingsRow } from "./SettingsRow"
import { SettingsSection } from "./SettingsSection"
import { SMALL_BUTTON } from "./styles"

export function DataSection() {
  const toast = useToast()

  const exportChats = async () => {
    const chats = await chatsItem.getValue()
    if (Object.keys(chats).length === 0) {
      toast("Nothing to export")
      return
    }
    downloadText("youtube-ai-chats.md", exportAllChats(chats))
    toast("Exported chats")
  }

  const clearChats = async () => {
    await chatsItem.setValue({})
    toast("Chat history cleared")
  }

  return (
    <SettingsSection label="Data">
      <SettingsRow
        title="Export chats"
        note="Markdown, all videos in one file"
        control={
          <button
            type="button"
            onClick={() => void exportChats()}
            className={cn(SMALL_BUTTON, "bg-secondary text-foreground hover:bg-muted")}
          >
            Export
          </button>
        }
      />
      <SettingsRow
        title="Clear chat history"
        note="Stored locally. Can't be undone."
        control={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className={cn(SMALL_BUTTON, "bg-danger-soft text-destructive hover:opacity-90")}
              >
                Clear
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes saved chats for every video on this device.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void clearChats()}
                  className="bg-danger-soft text-destructive hover:bg-danger-soft hover:opacity-90"
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />
    </SettingsSection>
  )
}
