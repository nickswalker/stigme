import { useState, useEffect, useCallback, useRef } from 'react'
import { CounterView } from './CounterView'
import { CounterList } from './CounterList'
import { SettingsView } from './SettingsView'
import { getCounters, saveCounter, deleteCounter, type Counter } from './db'
import { BUTTON_HUES } from './colors'
import './App.css'

export default function App() {
  const [counters, setCounters] = useState<Counter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'counter' | 'list' | 'settings'>('counter')
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
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
    setActiveId(counter.id)
    setView('counter')
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
    setSlideDir(null)
    setActiveId(id)
    setView('counter')
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (view !== 'counter' || counters.length <= 1 || view === 'settings') return
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
      setSlideDir('left')
      setActiveId(counters[activeIdx + 1].id)
    } else if (dx > 0 && activeIdx > 0) {
      setSlideDir('right')
      setActiveId(counters[activeIdx - 1].id)
    }
  }, [activeId, counters])

  const onCounterUpdate = useCallback((updated: Counter) => {
    setCounters(prev => prev.map(c => c.id === updated.id ? updated : c))
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
          slideDir={slideDir}
          prevHue={prevHue}
          nextHue={nextHue}
          onShowList={() => setView('list')}
          onCounterUpdate={onCounterUpdate}
        />
      ) : view === 'list' ? (
        <CounterList
          counters={counters}
          activeId={activeId}
          onSelect={selectCounter}
          onAdd={addCounter}
          onDelete={removeCounter}
          onClose={() => setView('counter')}
          onShowSettings={() => setView('settings')}
        />
      ) : (
        <SettingsView onClose={() => setView('list')} />
      )}
    </div>
  )
}
