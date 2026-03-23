import { useState, useCallback, useEffect, useRef } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotes, addNote, type Counter, type TapRecord, type NoteRecord } from './db'
import { NoteModal } from './NoteModal'
import { playTap } from './tapSound'
import { counterHue } from './colors'
import './MultiCounterView.css'
import './CounterView.css'

interface Props {
  counters: Counter[]
  multiViewIds: string[]
  onMultiViewIdsChange: (ids: string[]) => void
  onShowList: () => void
  onCounterUpdate: (counter: Counter) => void
}

interface CellProps {
  counter: Counter
  onFlash: (hue: number) => void
  onCounterUpdate: (counter: Counter) => void
}

function formatElapsed(ms: number): string {
  const totalS = ms / 1000
  const ss = Math.floor(totalS)
  const mm = Math.floor(ss / 60)
  const hh = Math.floor(mm / 60)
  const dd = Math.floor(hh / 24)
  if (mm === 0) return `${ss}.${Math.floor((ms % 1000) / 100)}`
  if (hh === 0) return `${mm}:${String(ss % 60).padStart(2, '0')}`
  if (dd === 0) return `${hh}:${String(mm % 60).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}`
  return `${dd}:${String(hh % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}`
}

function MultiCounterCell({ counter, onFlash, onCounterUpdate }: CellProps) {
  const hue = counterHue(counter)
  const { count, loading, increment, decrement, undo, canUndo } = useCounter(counter.id)
  const [showNote, setShowNote] = useState(false)
  const [, forceUpdate] = useState(0)
  const [streak, setStreak] = useState(0)
  const streakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapAtRef = useRef<number | null>(null)
  const lastElapsedUpdateRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    if (loading) return
    getTapsForCounter(counter.id).then(taps => {
      if (taps.length > 0) {
        lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
      }
    })
  }, [counter.id, loading])

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

  const handleTap = useCallback(async () => {
    playTap(hue, 1)
    await increment()
    const now = Date.now()
    lastTapAtRef.current = now
    lastElapsedUpdateRef.current = now
    setElapsed(0)
    forceUpdate(n => n + 1)
    onFlash(hue)
    if ('vibrate' in navigator) navigator.vibrate(10)
    onCounterUpdate({ ...counter })
    setStreak(s => s + 1)
    if (streakTimer.current) clearTimeout(streakTimer.current)
    streakTimer.current = setTimeout(() => setStreak(0), 1500)
  }, [increment, hue, onFlash, counter, onCounterUpdate])

  const handleDecrement = useCallback(async () => {
    playTap(hue, -1)
    await decrement()
    forceUpdate(n => n + 1)
    onCounterUpdate({ ...counter })
  }, [decrement, counter, onCounterUpdate])

  const handleUndo = useCallback(async () => {
    await undo()
    forceUpdate(n => n + 1)
  }, [undo])

  const handleSaveNote = useCallback(async (text: string) => {
    await addNote(text, counter.name)
    setShowNote(false)
  }, [counter.name])

  if (loading) return <div className="cell-loading" />

  return (
    <div className="multi-cell">
      <div className="cell-count">{count.toLocaleString()}</div>
      {elapsed != null && <div className="cell-elapsed">{formatElapsed(elapsed)}</div>}
      <button
        className="cell-tap-btn"
        style={{ '--btn-hue': hue } as React.CSSProperties}
        onClick={handleTap}
        aria-label={`Tap ${counter.name}`}
      >
        <span className="cell-name">{counter.name}</span>
        {streak >= 2 && <span className="cell-streak">{streak}</span>}
      </button>
      <div className="cell-controls">
        <button className="cell-ctrl" onClick={handleDecrement} aria-label="Decrement">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          className={`cell-ctrl ${!canUndo() ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo()}
          aria-label="Undo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 00-4-4H4" />
          </svg>
        </button>
        <button className="cell-ctrl" onClick={() => setShowNote(true)} aria-label="Add note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 7.5-7.5z" />
          </svg>
        </button>
      </div>
      {showNote && <NoteModal onSave={handleSaveNote} onClose={() => setShowNote(false)} />}
    </div>
  )
}

type HistoryEntry =
  | { kind: 'tap'; rec: TapRecord; counterName: string; counterHue: number }
  | { kind: 'note'; rec: NoteRecord; counterHue: number }

export function MultiCounterView({ counters, multiViewIds, onMultiViewIdsChange, onShowList, onCounterUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [flashState, setFlashState] = useState<{ key: number; hue: number }>({ key: 0, hue: 0 })

  const cells = multiViewIds
    .map(id => counters.find(c => c.id === id))
    .filter(Boolean) as Counter[]

  const is2up = cells.length <= 2 && !editing
  const totalSlots = is2up ? 2 : 4
  const availableToAdd = counters.filter(c => !multiViewIds.includes(c.id))

  const handleFlash = useCallback((hue: number) => {
    setFlashState(s => ({ key: s.key + 1, hue }))
  }, [])

  const handleAdd = useCallback((id: string) => {
    if (multiViewIds.length >= 4) return
    onMultiViewIdsChange([...multiViewIds, id])
    setShowPicker(false)
  }, [multiViewIds, onMultiViewIdsChange])

  const handleRemove = useCallback((id: string) => {
    onMultiViewIdsChange(multiViewIds.filter(x => x !== id))
  }, [multiViewIds, onMultiViewIdsChange])

  const openHistory = useCallback(async () => {
    const counterMap = new Map(counters.map(c => [c.id, c]))
    const cellNames = new Map(cells.map(c => [c.name, c]))
    const [allTaps, notes] = await Promise.all([
      Promise.all(cells.map(c => getTapsForCounter(c.id))).then(r => r.flat()),
      getNotes(),
    ])
    const entries: HistoryEntry[] = [
      ...allTaps.map(rec => {
        const c = counterMap.get(rec.counterId)
        return {
          kind: 'tap' as const,
          rec,
          counterName: c?.name ?? rec.counterId,
          counterHue: counterHue(c),
        }
      }),
      ...notes
        .filter(n => cellNames.has(n.counterName))
        .map(rec => {
          const c = cellNames.get(rec.counterName)
          return {
            kind: 'note' as const,
            rec,
            counterHue: counterHue(c),
          }
        }),
    ].sort((a, b) => b.rec.timestamp - a.rec.timestamp)
    setHistory(entries)
    setShowHistory(true)
  }, [cells, counters])

  const downloadHistory = useCallback(async () => {
    const counterMap = new Map(counters.map(c => [c.id, c.name]))
    const cellNames = new Set(cells.map(c => c.name))
    const [allTaps, notes] = await Promise.all([
      Promise.all(cells.map(c => getTapsForCounter(c.id))).then(r => r.flat()),
      getNotes(),
    ])
    const tapRows = allTaps.map(r => ({
      ts: r.timestamp,
      cols: [counterMap.get(r.counterId) ?? r.counterId, r.value >= 0 ? 'increment' : 'decrement', String(r.value), ''],
    }))
    const noteRows = notes
      .filter(n => cellNames.has(n.counterName))
      .map(n => ({ ts: n.timestamp, cols: [n.counterName, 'note', '', n.text.replace(/\t|\n/g, ' ')] }))
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
    a.download = 'multi_counter_history.tsv'
    a.click()
    URL.revokeObjectURL(url)
  }, [cells, counters])

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  return (
    <div className="multi-view">
      {/* Header */}
      <div className="counter-top">
        <div className="multi-header">
          <button className="icon-btn" onClick={onShowList} aria-label="Back to list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="multi-title">Multi Counter</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" onClick={() => { setShowSettings(s => !s); setEditing(false) }} aria-label="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            <button className="icon-btn" onClick={() => { setEditing(e => !e); setShowSettings(false) }} aria-label={editing ? 'Done' : 'Edit'}>
              {editing
                ? <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', padding: '0 4px' }}>Done</span>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
              }
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <>
            <div className="settings-backdrop" onClick={() => setShowSettings(false)} />
            <div className="settings-panel">
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

      {/* Grid: 2-up (1 row) or 4-up (2 rows) based on cell count */}
      <div className={`multi-grid ${is2up ? 'multi-grid--2up' : 'multi-grid--4up'}`}>
        {Array.from({ length: totalSlots }, (_, slot) => {
          const counter = cells[slot]
          if (counter) {
            return (
              <div key={counter.id} className="multi-slot">
                {editing && (
                  <button className="cell-remove-btn" onClick={() => handleRemove(counter.id)} aria-label={`Remove ${counter.name}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
                <MultiCounterCell
                  counter={counter}
                  onFlash={handleFlash}
                  onCounterUpdate={onCounterUpdate}
                />
              </div>
            )
          }
          const isNextSlot = slot === cells.length
          return (
            <button
              key={`empty-${slot}`}
              className={`multi-slot multi-slot--empty ${isNextSlot || editing ? '' : 'multi-slot--hidden'}`}
              onClick={isNextSlot || editing ? () => setShowPicker(true) : undefined}
              aria-label="Add counter"
            >
              {(isNextSlot || editing) && (
                <span className="add-slot-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tap flash */}
      {flashState.key > 0 && (
        <div key={flashState.key} className="tap-flash" style={{ '--flash-hue': flashState.hue } as React.CSSProperties} />
      )}

      {/* Picker modal */}
      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Counter</h2>
              <button className="icon-btn" onClick={() => setShowPicker(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {availableToAdd.length === 0 ? (
              <p className="empty-msg">All counters are already shown</p>
            ) : (
              <div className="picker-list">
                {availableToAdd.map(c => {
                  return (
                    <button key={c.id} className="picker-item" onClick={() => handleAdd(c.id)}>
                      <span className="picker-dot" style={{ background: `hsl(${counterHue(c)}, 70%, 58%)` }} />
                      <span>{c.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
            <div className="history-list">
              {history.length === 0 ? (
                <p className="empty-msg">No history yet</p>
              ) : (
                history.map((entry, i) => {
                  const key = entry.kind === 'tap' ? `tap-${entry.rec.id}` : `note-${entry.rec.id ?? i}`
                  const dotStyle = { background: `hsl(${entry.counterHue}, 70%, 58%)` }
                  return (
                    <div key={key}>
                      {entry.kind === 'tap' ? (
                        <div className="history-item">
                          <span className="history-counter-identity">
                            <span className="history-counter-dot" style={dotStyle} />
                            <span className="history-counter-name">{entry.counterName}</span>
                          </span>
                          <span className={`history-value ${entry.rec.value >= 0 ? 'positive' : 'negative'}`}>
                            {entry.rec.value >= 0 ? '+' : ''}{entry.rec.value}
                          </span>
                          <span className="history-time">{formatTimestamp(entry.rec.timestamp)}</span>
                        </div>
                      ) : (
                        <div className="history-item history-item--note">
                          <span className="history-counter-identity">
                            <span className="history-counter-dot" style={dotStyle} />
                            <span className="history-counter-name">{entry.rec.counterName}</span>
                          </span>
                          <span className="history-note-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                          </span>
                          <span className="history-note-text">{entry.rec.text}</span>
                          <span className="history-time">{formatTimestamp(entry.rec.timestamp)}</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
