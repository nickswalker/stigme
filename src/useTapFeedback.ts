import { useState, useRef, useEffect, useCallback } from 'react'
import { useElapsedTimer } from './useElapsedTimer'
import { playTap } from './tapSound'

// Shared tap feedback: sound, elapsed-timer reset, and (for increments) haptics,
// flash, and the streak counter with its auto-clearing timer.
export function useTapFeedback(hue: number, onFlash?: () => void) {
  const { elapsed, setElapsed, lastTapAtRef, lastElapsedUpdateRef } = useElapsedTimer()
  const [streak, setStreak] = useState(0)
  const streakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (streakTimer.current) clearTimeout(streakTimer.current)
  }, [])

  const markTap = useCallback((direction: 1 | -1) => {
    playTap(hue, direction)
    const now = Date.now()
    lastTapAtRef.current = now
    lastElapsedUpdateRef.current = now
    setElapsed(0)
    if (direction === 1) {
      if ('vibrate' in navigator) navigator.vibrate(10)
      onFlash?.()
      setStreak(s => s + 1)
      if (streakTimer.current) clearTimeout(streakTimer.current)
      streakTimer.current = setTimeout(() => setStreak(0), 1500)
    }
  }, [hue, onFlash, lastTapAtRef, lastElapsedUpdateRef, setElapsed])

  return { elapsed, setElapsed, streak, lastTapAtRef, lastElapsedUpdateRef, markTap }
}
