import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { CounterView } from './CounterView'
import { CounterList } from './CounterList'
import { MultiCounterView } from './MultiCounterView'
import { HelpView } from './HelpView'
import { getCounters, saveCounter, saveCounters, deleteCounter, clearAllData, type Counter } from './db'
import { BUTTON_HUES, counterHue } from './colors'
import { getPreferWakeLock, setPreferWakeLock } from './preferences'
import './App.css'

function startVT(dir: string, fn: () => void) {
  const { documentElement } = document
  documentElement.dataset.vt = dir
  const cleanup = () => { delete documentElement.dataset.vt }
  if (document.startViewTransition) {
    // `.finished` rejects when a transition is skipped; `.finally` still cleans
    // up, and the trailing `.catch` swallows the (expected) rejection.
    document.startViewTransition(() => { flushSync(fn) }).finished.finally(cleanup).catch(() => {})
  } else {
    fn()
    cleanup()
  }
}

function loadMultiViewIds(): string[] {
  try { return JSON.parse(localStorage.getItem('multiViewIds') ?? '[]') }
  catch { return [] }
}

export default function App() {
  const [counters, setCounters] = useState<Counter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'counter' | 'list' | 'multi' | 'help'>('counter')
  const [multiViewIds, setMultiViewIds] = useState<string[]>(loadMultiViewIds)
  const [wakeLockEnabled, setWakeLockEnabled] = useState(getPreferWakeLock)

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [prevView, setPrevView] = useState<'counter' | 'multi'>('counter')

  useEffect(() => {
    if (!wakeLockEnabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    async function acquire() {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        // Cleanup may have run while the request was in flight — release now.
        if (cancelled) { sentinel.release(); sentinel = null }
      } catch { /* denied or unavailable */ }
    }
    acquire()
    function onVisibility() { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
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
      setPreferWakeLock(next)
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
  }, [counters])

  const removeCounter = useCallback(async (id: string) => {
    await deleteCounter(id)
    const nextCounters = counters.filter(c => c.id !== id)
    setCounters(nextCounters)
    if (activeId === id) setActiveId(nextCounters[0]?.id ?? null)
    const nextMultiViewIds = multiViewIds.filter(x => x !== id)
    setMultiViewIds(nextMultiViewIds)
    localStorage.setItem('multiViewIds', JSON.stringify(nextMultiViewIds))
  }, [activeId, counters, multiViewIds])

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

  const goPrev = useCallback(() => {
    const idx = counters.findIndex(c => c.id === activeId)
    if (idx > 0) startVT('swipe-right', () => setActiveId(counters[idx - 1].id))
  }, [activeId, counters])

  const goNext = useCallback(() => {
    const idx = counters.findIndex(c => c.id === activeId)
    if (idx >= 0 && idx < counters.length - 1) {
      startVT('swipe-left', () => setActiveId(counters[idx + 1].id))
    }
  }, [activeId, counters])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !activeId) return
    const start = touchStartRef.current
    touchStartRef.current = null
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0) goNext()
    else goPrev()
  }, [activeId, goPrev, goNext])

  // Arrow keys switch counters when viewing one, unless a modal is open or
  // focus is in a text field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (view !== 'counter') return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as Element | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (document.querySelector('.modal-overlay')) return
      if (e.key === 'ArrowLeft') goPrev()
      else goNext()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [view, goPrev, goNext])

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

  const handleResetAll = useCallback(async () => {
    await clearAllData()
    localStorage.removeItem('multiViewIds')
    const defaultCounter: Counter = {
      id: crypto.randomUUID(),
      name: 'Counter',
      createdAt: Date.now(),
      step: 1,
      colorIndex: 0,
    }
    await saveCounter(defaultCounter)
    setCounters([defaultCounter])
    setActiveId(defaultCounter.id)
    setMultiViewIds([])
    setView('counter')
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
          key={activeId}
          counterId={activeId}
          initialHue={counterHue(activeCounter)}
          prevHue={prevHue}
          nextHue={nextHue}
          onShowList={() => { setPrevView('counter'); startVT('to-list', () => setView('list')) }}
          onCounterUpdate={onCounterUpdate}
          onPrev={prevCounter ? goPrev : null}
          onNext={nextCounter ? goNext : null}
        />
      ) : view === 'multi' ? (
        <MultiCounterView
          counters={counters}
          multiViewIds={multiViewIds}
          onMultiViewIdsChange={handleMultiViewIdsChange}
          onShowList={() => { setPrevView('multi'); startVT('to-list', () => setView('list')) }}
        />
      ) : view === 'help' ? (
        <HelpView onClose={() => startVT('to-list', () => setView('list'))} />
      ) : (
        <CounterList
          counters={counters}
          activeId={activeId}
          onSelect={selectCounter}
          onAdd={addCounter}
          onDelete={removeCounter}
          onClose={() => startVT('to-counter', () => setView(prevView))}
          onShowMulti={() => startVT('to-counter', () => setView('multi'))}
          onReorder={onReorder}
          onRename={onRename}
          onRecolor={onRecolor}
          wakeLockEnabled={wakeLockEnabled}
          onToggleWakeLock={toggleWakeLock}
          onResetAll={handleResetAll}
          onShowHelp={() => startVT('to-counter', () => setView('help'))}
          fromMulti={prevView === 'multi'}
          multiViewIds={multiViewIds}
        />
      )}
    </div>
  )
}
