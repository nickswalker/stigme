import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { CounterView } from './CounterView'
import { CounterList } from './CounterList'
import { getCounters, saveCounter, saveCounters, deleteCounter, type Counter } from './db'
import { BUTTON_HUES } from './colors'
import './App.css'

function startVT(dir: string, fn: () => void) {
  document.documentElement.dataset.vt = dir
  if ('startViewTransition' in document) {
    const t = (document as any).startViewTransition(() => { flushSync(fn) })
    t.finished.then(() => { delete document.documentElement.dataset.vt })
  } else {
    fn()
    delete document.documentElement.dataset.vt
  }
}

export default function App() {
  const [counters, setCounters] = useState<Counter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'counter' | 'list'>('counter')
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    getCounters().then(list => {
      if (list.length === 0) {
        const defaultCounter: Counter = {
          id: crypto.randomUUID(),
          name: 'Counter',
          createdAt: Date.now(),
          step: 1,
        }
        saveCounter(defaultCounter).then(() => {
          setCounters([defaultCounter])
          setActiveId(defaultCounter.id)
        })
      } else {
        setCounters(list)
        setActiveId(list[0].id)
      }
    })
  }, [])

  const addCounter = useCallback(async () => {
    const counter: Counter = {
      id: crypto.randomUUID(),
      name: `Counter ${counters.length + 1}`,
      createdAt: Date.now(),
      step: 1,
    }
    await saveCounter(counter)
    setCounters(prev => [...prev, counter])
    startVT('to-counter', () => {
      setActiveId(counter.id)
      setView('counter')
    })
  }, [counters.length])

  const removeCounter = useCallback(async (id: string) => {
    await deleteCounter(id)
    setCounters(prev => {
      const next = prev.filter(c => c.id !== id)
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null)
      }
      return next
    })
  }, [activeId])

  const selectCounter = useCallback((id: string) => {
    startVT('to-counter', () => {
      setActiveId(id)
      setView('counter')
    })
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (view !== 'counter' || counters.length <= 1) return
    if ((e.target as Element).closest?.('.modal-overlay')) return
    const t = e.touches[0]
    if (t.clientX < 20 || t.clientX > window.innerWidth - 20) return
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [view, counters.length])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !activeId) return
    const start = touchStartRef.current
    touchStartRef.current = null
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return
    const activeIdx = counters.findIndex(c => c.id === activeId)
    if (dx < 0 && activeIdx < counters.length - 1) {
      startVT('swipe-left', () => setActiveId(counters[activeIdx + 1].id))
    } else if (dx > 0 && activeIdx > 0) {
      startVT('swipe-right', () => setActiveId(counters[activeIdx - 1].id))
    }
  }, [activeId, counters])

  const onCounterUpdate = useCallback((updated: Counter) => {
    setCounters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }, [])

  const onReorder = useCallback(async (reordered: Counter[]) => {
    setCounters(reordered)
    await saveCounters(reordered)
  }, [])

  if (!activeId) return null

  const activeIdx = counters.findIndex(c => c.id === activeId)
  const prevHue = activeIdx > 0 ? BUTTON_HUES[(activeIdx - 1) % BUTTON_HUES.length] : null
  const nextHue = activeIdx < counters.length - 1 ? BUTTON_HUES[(activeIdx + 1) % BUTTON_HUES.length] : null

  return (
    <div
      className="app"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {view === 'counter' ? (
        <CounterView
          key={activeId}
          counterId={activeId}
          colorIndex={activeIdx}
          prevHue={prevHue}
          nextHue={nextHue}
          onShowList={() => startVT('to-list', () => setView('list'))}
          onCounterUpdate={onCounterUpdate}
        />
      ) : (
        <CounterList
          counters={counters}
          activeId={activeId}
          onSelect={selectCounter}
          onAdd={addCounter}
          onDelete={removeCounter}
          onClose={() => startVT('to-counter', () => setView('counter'))}
          onReorder={onReorder}
        />
      )}
    </div>
  )
}
