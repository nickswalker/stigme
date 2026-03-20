import { useState, useEffect, useCallback } from 'react'
import {
  addTap,
  removeTap,
  getLastTap,
  getTapCount,
  clearTaps,
  saveCounter,
  getCounter,
  type Counter,
} from './db'

export function useCounter(counterId: string) {
  const [count, setCount] = useState(0)
  const [counter, setCounter] = useState<Counter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, n] = await Promise.all([getCounter(counterId), getTapCount(counterId)])
      if (cancelled) return
      if (c) {
        setCounter(c)
      } else {
        const newCounter: Counter = {
          id: counterId,
          name: 'Counter',
          createdAt: Date.now(),
          step: 1,
        }
        await saveCounter(newCounter)
        setCounter(newCounter)
      }
      setCount(n)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [counterId])

  const increment = useCallback(async () => {
    await addTap(counterId)
    setCount(c => c + (counter?.step ?? 1))
  }, [counterId, counter])

  const decrement = useCallback(async () => {
    const last = await getLastTap(counterId)
    if (!last || last.id == null) return
    await removeTap(last.id)
    setCount(c => Math.max(0, c - (counter?.step ?? 1)))
  }, [counterId, counter])

  const reset = useCallback(async () => {
    await clearTaps(counterId)
    setCount(0)
  }, [counterId])

  const rename = useCallback(async (name: string) => {
    if (!counter) return
    const updated = { ...counter, name }
    await saveCounter(updated)
    setCounter(updated)
  }, [counter])

  const setStep = useCallback(async (step: number) => {
    if (!counter) return
    const updated = { ...counter, step }
    await saveCounter(updated)
    setCounter(updated)
  }, [counter])

  return { count, counter, loading, increment, decrement, reset, rename, setStep }
}
