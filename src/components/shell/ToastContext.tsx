import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

const TOAST_MS = 1800

const ToastContext = createContext<((message: string) => void) | null>(null)

/**
 * Holds one toast at a time (a new one replaces the previous) and renders it absolutely,
 * bottom-left with a 12px inset, against the nearest positioned ancestor (the panel card).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback((message: string) => {
    clearTimeout(timerRef.current)
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }))
    timerRef.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-none absolute bottom-[12px] left-[12px] z-40 max-w-[calc(100%-24px)] rounded-[8px] bg-primary px-[12px] py-[8px] text-[13px] leading-[18px] text-primary-foreground shadow-pop animate-in fade-in-0"
        >
          {toast.message}
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): (message: string) => void {
  const show = useContext(ToastContext)
  if (!show) throw new Error("useToast must be used inside a ToastProvider")
  return show
}
