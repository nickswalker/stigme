import { useState, useEffect, useRef } from 'react'

export function useElapsedTimer() {
  const [elapsed, setElapsed] = useState<number | null>(null)
  const lastTapAtRef = useRef<number | null>(null)
  const lastElapsedUpdateRef = useRef<number>(0)

  useEffect(() => {
    let rafId: number
    function tick() {
      const now = Date.now()
      const last = lastTapAtRef.current
      if (last != null) {
        const ms = now - last
        const interval = ms < 60_000 ? 100 : 1_000
        if (now - lastElapsedUpdateRef.current >= interval) {
          setElapsed(ms)
          lastElapsedUpdateRef.current = now
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return { elapsed, setElapsed, lastTapAtRef, lastElapsedUpdateRef }
}
