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
  const [canUndo, setCanUndo] = useState(false)
  const undoStack = useRef<TapRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, n] = await Promise.all([getCounter(counterId), getCount(counterId)])
      if (cancelled) return
      // Leave counter null if it isn't known — callers use `counter?.` fallbacks.
      // Creating one here would produce a counter App has no record of.
      setCounter(c ?? null)
      setCount(n)
      undoStack.current = []
      setCanUndo(false)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [counterId])

  const increment = useCallback(async () => {
    const step = counter?.step ?? 1
    const record = await addTap(counterId, step)
    undoStack.current.push(record)
    setCanUndo(true)
    setCount(c => c + step)
  }, [counterId, counter])

  const decrement = useCallback(async () => {
    const step = counter?.step ?? 1
    const record = await addTap(counterId, -step)
    undoStack.current.push(record)
    setCanUndo(true)
    setCount(c => c - step)
  }, [counterId, counter])

  const undo = useCallback(async () => {
    const last = undoStack.current.pop()
    setCanUndo(undoStack.current.length > 0)
    if (!last || last.id == null) return
    await removeTap(last.id)
    setCount(c => c - last.value)
  }, [])

  const deleteTap = useCallback(async (id: number, value: number) => {
    await removeTap(id)
    undoStack.current = []
    setCanUndo(false)
    setCount(c => c - value)
  }, [])

  const reset = useCallback(async () => {
    await clearTaps(counterId)
    undoStack.current = []
    setCanUndo(false)
    setCount(0)
  }, [counterId])

  // Re-read the persisted count and drop the undo stack. Used when taps are
  // deleted out-of-band (e.g. from the multi-view history modal).
  const reload = useCallback(async () => {
    const n = await getCount(counterId)
    undoStack.current = []
    setCanUndo(false)
    setCount(n)
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

  return { count, counter, loading, increment, decrement, undo, canUndo, deleteTap, reset, reload, rename, setStep }
}
