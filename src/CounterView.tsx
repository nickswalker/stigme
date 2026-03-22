import { useState, useCallback, useRef, useEffect } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotes, addNote, deleteNote, type TapRecord, type NoteRecord } from './db'
import type { Counter } from './db'
import { NoteModal } from './NoteModal'
import { playTap } from './tapSound'
import './CounterView.css'

import { counterHue } from './colors'

interface Props {
  counterId: string
  initialHue: number
  prevHue?: number | null
  nextHue?: number | null
  onShowList: () => void
  onCounterUpdate: (counter: Counter) => void
}

type HistoryEntry =
  | { kind: 'tap'; rec: TapRecord }
  | { kind: 'note'; rec: NoteRecord }

export function CounterView({ counterId, initialHue, prevHue, nextHue, onShowList, onCounterUpdate }: Props) {
  const { count, counter, loading, increment, decrement, undo, canUndo, deleteTap, reset, rename, setStep } = useCounter(counterId)
  const hue = counter ? counterHue(counter) : initialHue
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showNote, setShowNote] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [, forceUpdate] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [swipedKey, setSwipedKey] = useState<string | null>(null)
  const rowTouchRef = useRef<{ startX: number; startY: number; key: string } | null>(null)
  const tapButtonRef = useRef<HTMLButtonElement>(null)
  const [streak, setStreak] = useState(0)
  const streakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lastTapAtRef = useRef<number | null>(null)
  const lastElapsedUpdateRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState<number | null>(null)

  // Load last tap timestamp on mount
  useEffect(() => {
    if (loading) return
    getTapsForCounter(counterId).then(taps => {
      if (taps.length > 0) {
        lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
        lastElapsedUpdateRef.current = 0
      }
    })
  }, [counterId, loading])

  // rAF ticker: updates elapsed at 100ms precision when <1min, 1s otherwise
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

  const refreshLastTapAt = useCallback(async () => {
    const taps = await getTapsForCounter(counterId)
    if (taps.length > 0) {
      lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
      lastElapsedUpdateRef.current = 0
    } else {
      lastTapAtRef.current = null
      setElapsed(null)
    }
  }, [counterId])

  const handleTap = useCallback(async () => {
    playTap(hue, 1)
    await increment()
    const now = Date.now()
    lastTapAtRef.current = now
    lastElapsedUpdateRef.current = now
    setElapsed(0)
    forceUpdate(n => n + 1)
    setFlashKey(k => k + 1)
    if (counter) onCounterUpdate({ ...counter })
    if ('vibrate' in navigator) navigator.vibrate(10)

    setStreak(s => s + 1)
    if (streakTimer.current) clearTimeout(streakTimer.current)
    streakTimer.current = setTimeout(() => setStreak(0), 1500)
  }, [increment, counter, onCounterUpdate])

  const handleDecrement = useCallback(async () => {
    playTap(hue, -1)
    await decrement()
    const now = Date.now()
    lastTapAtRef.current = now
    lastElapsedUpdateRef.current = now
    setElapsed(0)
    forceUpdate(n => n + 1)
    if (counter) onCounterUpdate({ ...counter })
  }, [decrement, counter, onCounterUpdate])

  const handleUndo = useCallback(async () => {
    await undo()
    forceUpdate(n => n + 1)
    await refreshLastTapAt()
  }, [undo, refreshLastTapAt])

  const handleReset = useCallback(async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    await reset()
    setConfirmReset(false)
    lastTapAtRef.current = null
    setElapsed(null)
    forceUpdate(n => n + 1)
    if (counter) onCounterUpdate({ ...counter })
  }, [reset, confirmReset, counter, onCounterUpdate])

const handleSaveNote = useCallback(async (text: string) => {
    await addNote(text, counter?.name ?? 'Counter')
    setShowNote(false)
    requestAnimationFrame(() => window.scrollTo(0, 0))
  }, [counter])

  const startRename = useCallback(() => {
    setNameInput(counter?.name ?? '')
    setEditingName(true)
  }, [counter])

  const submitRename = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      await rename(trimmed)
      if (counter) onCounterUpdate({ ...counter, name: trimmed })
    }
    setEditingName(false)
  }, [nameInput, rename, counter, onCounterUpdate])

  const openHistory = useCallback(async () => {
    const [taps, notes] = await Promise.all([
      getTapsForCounter(counterId),
      getNotes(),
    ])
    const counterName = counter?.name ?? 'Counter'
    const entries: HistoryEntry[] = [
      ...taps.map(rec => ({ kind: 'tap' as const, rec })),
      ...notes
        .filter(n => n.counterName === counterName)
        .map(rec => ({ kind: 'note' as const, rec })),
    ].sort((a, b) => b.rec.timestamp - a.rec.timestamp)
    setHistory(entries)
    setShowHistory(true)
  }, [counterId, counter])

  const handleDeleteEntry = useCallback(async (entry: HistoryEntry) => {
    if (entry.kind === 'tap' && entry.rec.id != null) {
      await deleteTap(entry.rec.id, entry.rec.value)
      forceUpdate(n => n + 1)
      await refreshLastTapAt()
    } else if (entry.kind === 'note' && entry.rec.id != null) {
      await deleteNote(entry.rec.id)
    }
    setHistory(prev => prev.filter(e => e !== entry))
    setSwipedKey(null)
  }, [deleteTap, refreshLastTapAt])

  function onRowTouchStart(e: React.TouchEvent, key: string) {
    const t = e.touches[0]
    rowTouchRef.current = { startX: t.clientX, startY: t.clientY, key }
  }

  function onRowTouchMove(e: React.TouchEvent) {
    if (!rowTouchRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - rowTouchRef.current.startX
    const dy = t.clientY - rowTouchRef.current.startY
    if (Math.abs(dy) > Math.abs(dx) + 5) { rowTouchRef.current = null; return }
    const { key } = rowTouchRef.current
    if (dx < -40) setSwipedKey(key)
    else if (dx > 10 && swipedKey === key) setSwipedKey(null)
  }

  function onRowTouchEnd() { rowTouchRef.current = null }

  const downloadHistory = useCallback(async () => {
    const [taps, notes] = await Promise.all([
      getTapsForCounter(counterId),
      getNotes(),
    ])
    const name = counter?.name ?? 'Counter'
    const tapRows = taps.map(r => ({
      ts: r.timestamp,
      cols: [name, r.value >= 0 ? 'increment' : 'decrement', String(r.value), ''],
    }))
    const noteRows = notes
      .filter(n => n.counterName === name)
      .map(n => ({
        ts: n.timestamp,
        cols: [name, 'note', '', n.text.replace(/\t|\n/g, ' ')],
      }))
    const rows = [
      ['Counter', 'Action', 'Value', 'Note', 'Timestamp'].join('\t'),
      ...[...tapRows, ...noteRows]
        .sort((a, b) => a.ts - b.ts)
        .map(r => [...r.cols, new Date(r.ts).toISOString()].join('\t')),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/tab-separated-values' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[^a-z0-9]/gi, '_')}_history.tsv`
    a.click()
    URL.revokeObjectURL(url)
  }, [counterId, counter])

  if (loading) return <div className="counter-loading" />

  return (
    <div className="counter-view">
      {/* Header + floating settings panel */}
      <div className="counter-top">
      <div className="counter-header">
        <button className="icon-btn" onClick={onShowList} aria-label="Counters">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {editingName ? (
          <form onSubmit={e => { e.preventDefault(); submitRename() }} className="name-form">
            <input
              className="name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              autoFocus
              onBlur={submitRename}
            />
          </form>
        ) : (
          <button className="counter-name-btn" onClick={startRename}>
            {counter?.name ?? 'Counter'}
          </button>
        )}

        <button className="icon-btn" onClick={() => setShowSettings(s => !s)} aria-label="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      {showSettings && (
          <>
            <div className="settings-backdrop" onClick={() => setShowSettings(false)} />
            <div className="settings-panel">
              <div className="settings-row">
                <span>Step</span>
                <div className="step-control">
                  <button className="step-btn" onClick={() => setStep(Math.max(1, (counter?.step ?? 1) - 1))}>−</button>
                  <span className="step-value">{counter?.step ?? 1}</span>
                  <button className="step-btn" onClick={() => setStep((counter?.step ?? 1) + 1)}>+</button>
                </div>
              </div>
              <button className="settings-row history-btn" onClick={openHistory}>
                View history
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button className="settings-row history-btn" onClick={downloadHistory}>
                Download history (.tsv)
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Count display + tap button */}
      <div className="counter-middle">
        <div className="count-area">
          {prevHue != null && (
            <div className="edge-peek edge-peek--left" style={{ '--peek-hue': prevHue } as React.CSSProperties} />
          )}
          {nextHue != null && (
            <div className="edge-peek edge-peek--right" style={{ '--peek-hue': nextHue } as React.CSSProperties} />
          )}
          <div className="count-display">
            {count.toLocaleString()}
          </div>
          {elapsed != null && (
            <div className="elapsed-display">{formatElapsed(elapsed)}</div>
          )}
          {counter?.step && counter.step > 1 && (
            <div className="step-indicator">step: {counter.step}</div>
          )}
        </div>

        {/* Main tap button */}
        <button
          ref={tapButtonRef}
          className="tap-button"
          style={{ '--btn-hue': hue } as React.CSSProperties}
          onClick={handleTap}
          aria-label="Increment counter"
        >
          <span className="tap-label">TAP</span>
          {streak >= 2 && <span className="streak-label">{streak}</span>}
        </button>
      </div>

      {/* Bottom controls */}
      <div className="bottom-controls">
        <button className="ctrl-btn decrement" onClick={handleDecrement} aria-label="Decrement">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          className={`ctrl-btn undo ${!canUndo() ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo()}
          aria-label="Undo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 00-4-4H4" />
          </svg>
        </button>

        <button className="ctrl-btn note" onClick={() => setShowNote(true)} aria-label="Add note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 7.5-7.5z" />
          </svg>
        </button>

        <button
          className={`ctrl-btn reset ${confirmReset ? 'confirm' : ''}`}
          onClick={handleReset}
          aria-label="Reset"
        >
          {confirmReset ? (
            <span className="reset-confirm-text">Sure?</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
          )}
        </button>
      </div>

      {/* Note modal */}
      {showNote && (
        <NoteModal onSave={handleSaveNote} onClose={() => {
          setShowNote(false)
          // iOS keyboard dismissal leaves a lingering scroll offset — reset it
          requestAnimationFrame(() => window.scrollTo(0, 0))
        }} />
      )}

      {/* Tap flash */}
      {flashKey > 0 && <div key={flashKey} className="tap-flash" style={{ '--flash-hue': hue } as React.CSSProperties} />}

      {/* History modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>History</h2>
              <button className="icon-btn" onClick={() => setShowHistory(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="history-list" onClick={() => setSwipedKey(null)}>
              {history.length === 0 ? (
                <p className="empty-msg">No history yet</p>
              ) : (
                groupByDay(history).map((group, gi) =>
                  <div key={group.label} className="history-day-group">
                    <div className="history-day-header">{group.label}</div>
                    {group.entries.map((entry, i) => {
                      const globalIndex = gi * 1000 + i
                      const key = entry.kind === 'tap' ? `tap-${entry.rec.id}` : `note-${entry.rec.id ?? globalIndex}`
                      const swiped = swipedKey === key
                      return (
                        <div
                          key={key}
                          className="history-item-wrap"
                          onTouchStart={e => onRowTouchStart(e, key)}
                          onTouchMove={onRowTouchMove}
                          onTouchEnd={onRowTouchEnd}
                        >
                          {entry.kind === 'tap' ? (
                            <div className={`history-item${swiped ? ' swiped' : ''}`}>
                              <span className={`history-value ${entry.rec.value >= 0 ? 'positive' : 'negative'}`}>
                                {entry.rec.value >= 0 ? '+' : ''}{entry.rec.value}
                              </span>
                              <span className="history-time">{formatTimeOnly(entry.rec.timestamp, group.showSeconds)}</span>
                            </div>
                          ) : (
                            <div className={`history-item history-item--note${swiped ? ' swiped' : ''}`}>
                              <span className="history-note-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                              </span>
                              <span className="history-note-text">{entry.rec.text}</span>
                              <span className="history-time">{formatTimeOnly(entry.rec.timestamp, group.showSeconds)}</span>
                            </div>
                          )}
                          <button
                            className="history-delete-btn"
                            onClick={e => { e.stopPropagation(); handleDeleteEntry(entry) }}
                            aria-label="Delete entry"
                          >
                            Delete
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatElapsed(ms: number): string {
  const totalS = ms / 1000
  const ss = Math.floor(totalS)
  const mm = Math.floor(ss / 60)
  const hh = Math.floor(mm / 60)
  const dd = Math.floor(hh / 24)

  if (mm === 0) {
    const tenths = Math.floor((ms % 1000) / 100)
    return `${ss}.${tenths}`
  }
  if (hh === 0) {
    return `${mm}:${String(ss % 60).padStart(2, '0')}`
  }
  if (dd === 0) {
    return `${hh}:${String(mm % 60).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}`
  }
  return `${dd}:${String(hh % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}`
}

type DayGroup = {
  label: string
  entries: HistoryEntry[]
  showSeconds: boolean
}

function groupByDay(entries: HistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = []
  let currentKey = ''
  let currentGroup: DayGroup | null = null

  for (const entry of entries) {
    const d = new Date(entry.rec.timestamp)
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (dayKey !== currentKey) {
      currentKey = dayKey
      currentGroup = {
        label: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
        entries: [],
        showSeconds: false,
      }
      groups.push(currentGroup)
    }
    currentGroup!.entries.push(entry)
  }

  for (const group of groups) {
    const timestamps = group.entries.map(e => e.rec.timestamp)
    for (let i = 1; i < timestamps.length; i++) {
      if (Math.abs(timestamps[i - 1] - timestamps[i]) < 60_000) {
        group.showSeconds = true
        break
      }
    }
  }

  return groups
}

function formatTimeOnly(ts: number, showSeconds: boolean): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
  })
}
