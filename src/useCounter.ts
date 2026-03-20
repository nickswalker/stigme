import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addTap,
  removeTap,
  getCount,
  clearTaps,
  saveCounter,
  getCounter,
  type TapRecord,
  type Counter,
} from './db'

export function useCounter(counterId: string) {
  const [count, setCount] = useState(0)
  const [counter, setCounter] = useState<Counter | null>(null)
  const [loading, setLoading] = useState(true)
  const undoStack = useRef<TapRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, n] = await Promise.all([getCounter(counterId), getCount(counterId)])
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
    const step = counter?.step ?? 1
    const record = await addTap(counterId, step)
    undoStack.current.push(record)
    setCount(c => c + step)
  }, [counterId, counter])

  const decrement = useCallback(async () => {
    const step = counter?.step ?? 1
    const record = await addTap(counterId, -step)
    undoStack.current.push(record)
    setCount(c => c - step)
  }, [counterId, counter])

  const undo = useCallback(async () => {
    const last = undoStack.current.pop()
    if (!last || last.id == null) return
    await removeTap(last.id)
    setCount(c => c - last.value)
  }, [])

  const canUndo = useCallback(() => undoStack.current.length > 0, [])

  const reset = useCallback(async () => {
    await clearTaps(counterId)
    undoStack.current = []
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

  return { count, counter, loading, increment, decrement, undo, canUndo, reset, rename, setStep }
}
