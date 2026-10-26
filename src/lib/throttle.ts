export interface TrailingThrottle<T> {
  (value: T): void
  cancel(): void
}

/** Leading call passes immediately; calls inside the window are deferred and the last value wins. */
export function createTrailingThrottle<T>(fn: (value: T) => void, ms: number): TrailingThrottle<T> {
  let last = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T } | undefined

  const run = (value: T) => {
    last = Date.now()
    fn(value)
  }

  const throttled = ((value: T) => {
    const remaining = ms - (Date.now() - last)
    if (remaining <= 0) {
      clearTimeout(timer)
      timer = undefined
      pending = undefined
      run(value)
      return
    }
    pending = { value }
    if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined
        const p = pending
        pending = undefined
        if (p) run(p.value)
      }, remaining)
    }
  }) as TrailingThrottle<T>

  throttled.cancel = () => {
    clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  return throttled
}
