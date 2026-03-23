import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { CounterView } from './CounterView'
import { CounterList } from './CounterList'
import { MultiCounterView } from './MultiCounterView'
import { getCounters, saveCounter, saveCounters, deleteCounter, type Counter } from './db'
import { BUTTON_HUES, counterHue } from './colors'
import { getPreferWakeLock, WAKE_LOCK_KEY } from './SettingsView'
import './App.css'

function startVT(dir: string, fn: () => void) {
  const { documentElement } = document
  documentElement.dataset.vt = dir
  if ('startViewTransition' in document) {
    ;(document as any).startViewTransition(() => { flushSync(fn) })
      .finished.then(() => { delete documentElement.dataset.vt })
  } else {
    fn()
    delete documentElement.dataset.vt
  }
}

function loadMultiViewIds(): string[] {
  try { return JSON.parse(localStorage.getItem('multiViewIds') ?? '[]') }
  catch { return [] }
}

export default function App() {
  const [counters, setCounters] = useState<Counter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'counter' | 'list' | 'multi'>('counter')
  const [multiViewIds, setMultiViewIds] = useState<string[]>(loadMultiViewIds)
  const [wakeLockEnabled, setWakeLockEnabled] = useState(getPreferWakeLock)
  const [resetVersion, setResetVersion] = useState(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const prevViewRef = useRef<'counter' | 'multi'>('counter')

  useEffect(() => {
    if (!wakeLockEnabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    async function acquire() {
      try { sentinel = await (navigator as any).wakeLock.request('screen') } catch { /* denied or unavailable */ }
    }
    acquire()
    function onVisibility() { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release()
    }
  }, [wakeLockEnabled])

  useEffect(() => {
    document.body.dataset.view = view
  }, [view])

  const toggleWakeLock = useCallback(() => {
    setWakeLockEnabled(prev => {
      const next = !prev
      localStorage.setItem(WAKE_LOCK_KEY, String(next))
      return next
    })
  }, [])

  useEffect(() => {
    getCounters().then(list => {
      if (list.length === 0) {
        const defaultCounter: Counter = {
          id: crypto.randomUUID(),
          name: 'Counter',
          createdAt: Date.now(),
          step: 1,
          colorIndex: 0,
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
    const lastColorIndex = counters.length > 0
      ? (counters[counters.length - 1].colorIndex ?? 0)
      : -1
    const colorIndex = (lastColorIndex + 1) % BUTTON_HUES.length
    const counter: Counter = {
      id: crypto.randomUUID(),
      name: `Counter ${counters.length + 1}`,
      createdAt: Date.now(),
      step: 1,
      colorIndex,
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
    setMultiViewIds(prev => {
      const next = prev.filter(x => x !== id)
      localStorage.setItem('multiViewIds', JSON.stringify(next))
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

  const onRename = useCallback(async (id: string, name: string) => {
    const counter = counters.find(c => c.id === id)
    if (!counter) return
    const updated = { ...counter, name }
    await saveCounter(updated)
    setCounters(prev => prev.map(c => c.id === id ? updated : c))
  }, [counters])

  const onRecolor = useCallback(async (id: string, hue: number) => {
    const counter = counters.find(c => c.id === id)
    if (!counter) return
    const updated = { ...counter, customHue: hue }
    await saveCounter(updated)
    setCounters(prev => prev.map(c => c.id === id ? updated : c))
  }, [counters])

  const handleMultiViewIdsChange = useCallback((ids: string[]) => {
    setMultiViewIds(ids)
    localStorage.setItem('multiViewIds', JSON.stringify(ids))
  }, [])

  if (!activeId) return null

  const activeIdx = counters.findIndex(c => c.id === activeId)
  const activeCounter = counters[activeIdx]
  const prevCounter = activeIdx > 0 ? counters[activeIdx - 1] : null
  const nextCounter = activeIdx < counters.length - 1 ? counters[activeIdx + 1] : null
  const prevHue = prevCounter ? counterHue(prevCounter) : null
  const nextHue = nextCounter ? counterHue(nextCounter) : null

  return (
    <div
      className="app"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {view === 'counter' ? (
        <CounterView
          key={activeId + '-' + resetVersion}
          counterId={activeId}
          initialHue={counterHue(activeCounter)}
          prevHue={prevHue}
          nextHue={nextHue}
          onShowList={() => { prevViewRef.current = 'counter'; startVT('to-list', () => setView('list')) }}
          onCounterUpdate={onCounterUpdate}
        />
      ) : view === 'multi' ? (
        <MultiCounterView
          counters={counters}
          multiViewIds={multiViewIds}
          onMultiViewIdsChange={handleMultiViewIdsChange}
          onShowList={() => { prevViewRef.current = 'multi'; startVT('to-list', () => setView('list')) }}
          onCounterUpdate={onCounterUpdate}
        />
      ) : (
        <CounterList
          counters={counters}
          activeId={activeId}
          onSelect={selectCounter}
          onAdd={addCounter}
          onDelete={removeCounter}
          onClose={() => startVT('to-counter', () => setView(prevViewRef.current))}
          onShowMulti={() => startVT('to-counter', () => setView('multi'))}
          onReorder={onReorder}
          onRename={onRename}
          onRecolor={onRecolor}
          wakeLockEnabled={wakeLockEnabled}
          onToggleWakeLock={toggleWakeLock}
          onResetAll={() => setResetVersion(v => v + 1)}
        />
      )}
    </div>
  )
}
