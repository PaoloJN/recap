import { CircleNotch } from "@phosphor-icons/react"
import { useState } from "react"
import { SettingsRow } from "@/components/settings/SettingsRow"
import { SMALL_BUTTON } from "@/components/settings/styles"
import { useToast } from "@/components/shell/ToastContext"
import { usePro } from "@/hooks/usePro"
import { proUrl } from "@/lib/pro/config"
import { planLine } from "@/lib/pro/plan-copy"
import type { MeResponse } from "@/lib/pro/types"
import { cn } from "@/lib/utils"
import { GoogleMark } from "./GoogleMark"
import { useProSignIn } from "./useProSignIn"

const SECONDARY = cn(SMALL_BUTTON, "bg-secondary text-foreground hover:bg-muted")
const GHOST = cn(SMALL_BUTTON, "px-[10px] text-foreground hover:bg-secondary")

// At most one pending "refresh when back" listener per page. It outlives Settings on purpose:
// `refresh` is page-wide, so the account still updates if the user left Settings meanwhile.
let returnListener: (() => void) | null = null

/** Test hook: drop a pending return listener. */
export function resetReturnRefreshForTests(): void {
  if (returnListener) document.removeEventListener("visibilitychange", returnListener)
  returnListener = null
}

/**
 * Opens a Recap Pro account page in a new tab. The next time this tab becomes visible (back from
 * checkout or billing), the account is refetched whatever its age, then the listener goes away.
 */
function openPage(path: string, refresh: () => Promise<void>) {
  window.open(proUrl(path), "_blank", "noopener")
  resetReturnRefreshForTests()
  const onVisibility = () => {
    if (document.visibilityState !== "visible") return
    resetReturnRefreshForTests()
    void refresh()
  }
  returnListener = onVisibility
  document.addEventListener("visibilitychange", onVisibility)
}

/** 24px round avatar: the Google photo, or the first letter of the name/email on a muted circle. */
function Avatar({ user }: { user: MeResponse["user"] | null }) {
  const image = user?.image ?? null
  const [failed, setFailed] = useState<string | null>(null)
  if (image !== null && failed !== image) {
    return (
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(image)}
        className="size-[24px] shrink-0 rounded-full object-cover"
      />
    )
  }
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      data-avatar
      aria-hidden
      className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-muted-foreground"
    >
      {initial}
    </span>
  )
}

function SignInRow() {
  const { signIn, signingIn } = useProSignIn()
  return (
    <SettingsRow
      title="Account"
      note="Not signed in"
      control={
        <button
          type="button"
          aria-disabled={signingIn}
          onClick={() => {
            if (!signingIn) void signIn()
          }}
          className={SECONDARY}
        >
          {signingIn ? (
            <CircleNotch className="animate-spin" aria-hidden />
          ) : (
            <GoogleMark size={14} />
          )}
          Sign in with Google
        </button>
      }
    />
  )
}

/** Settings › Model rows for Recap Pro: account, plan with Upgrade/Manage billing, Sign out. */
export function AccountRows() {
  const { signedIn, me, signOut, refresh } = usePro()
  const toast = useToast()

  if (!signedIn) return <SignInRow />

  const user = me?.user ?? null
  return (
    <>
      <SettingsRow
        title={
          <span className="flex min-w-0 items-center gap-[10px]">
            <Avatar key={user?.image ?? ""} user={user} />
            <span className="truncate">{user?.email ?? "Recap Pro account"}</span>
          </span>
        }
        note={<span className="pl-[34px]">Signed in</span>}
      />
      {me ? (
        <SettingsRow
          title="Plan"
          note={planLine(me, Date.now())}
          control={
            me.plan === "pro" ? (
              <button
                type="button"
                onClick={() => openPage("/account", refresh)}
                className={SECONDARY}
              >
                Manage billing
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openPage("/account?upgrade=monthly", refresh)}
                className={SECONDARY}
              >
                Upgrade
              </button>
            )
          }
        />
      ) : null}
      <div className="p-[8px]">
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => toast("Signed out of Recap Pro"))
          }}
          className={GHOST}
        >
          Sign out
        </button>
      </div>
    </>
  )
}
