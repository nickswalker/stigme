import { useState, useCallback, useRef } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotes, addNote, type TapRecord, type NoteRecord } from './db'
import type { Counter } from './db'
import { NoteModal } from './NoteModal'
import './CounterView.css'

import { BUTTON_HUES } from './colors'

interface Props {
  counterId: string
  colorIndex: number
  slideDir?: 'left' | 'right' | null
  prevHue?: number | null
  nextHue?: number | null
  onShowList: () => void
  onCounterUpdate: (counter: Counter) => void
}

type HistoryEntry =
  | { kind: 'tap'; rec: TapRecord }
  | { kind: 'note'; rec: NoteRecord }

export function CounterView({ counterId, colorIndex, slideDir, prevHue, nextHue, onShowList, onCounterUpdate }: Props) {
  const hue = BUTTON_HUES[colorIndex % BUTTON_HUES.length]
  const { count, counter, loading, increment, decrement, undo, canUndo, reset, rename, setStep } = useCounter(counterId)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showNote, setShowNote] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [, forceUpdate] = useState(0)
  const tapButtonRef = useRef<HTMLButtonElement>(null)

  const handleTap = useCallback(async () => {
    await increment()
    forceUpdate(n => n + 1)
    if (counter) onCounterUpdate({ ...counter })
    if ('vibrate' in navigator) navigator.vibrate(10)
  }, [increment, counter, onCounterUpdate])

  const handleDecrement = useCallback(async () => {
    await decrement()
    forceUpdate(n => n + 1)
    if (counter) onCounterUpdate({ ...counter })
  }, [decrement, counter, onCounterUpdate])

  const handleUndo = useCallback(async () => {
    await undo()
    forceUpdate(n => n + 1)
  }, [undo])

  const handleReset = useCallback(async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    await reset()
    setConfirmReset(false)
    forceUpdate(n => n + 1)
    if (counter) onCounterUpdate({ ...counter })
  }, [reset, confirmReset, counter, onCounterUpdate])

  const handleSaveNote = useCallback(async (text: string) => {
    await addNote(text, counter?.name ?? 'Counter')
    setShowNote(false)
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
    <div className={`counter-view${slideDir ? ` slide-${slideDir}` : ''}`}>
      {/* Header */}
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

      {/* Settings panel */}
      {showSettings && (
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
      )}

      {/* Count display */}
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
      </button>

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
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0014 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="9" y1="22" x2="15" y2="22" />
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
        <NoteModal onSave={handleSaveNote} onClose={() => setShowNote(false)} />
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
                history.map((entry, i) =>
                  entry.kind === 'tap' ? (
                    <div key={`tap-${entry.rec.id}`} className="history-item">
                      <span className={`history-value ${entry.rec.value >= 0 ? 'positive' : 'negative'}`}>
                        {entry.rec.value >= 0 ? '+' : ''}{entry.rec.value}
                      </span>
                      <span className="history-time">{formatTimestamp(entry.rec.timestamp)}</span>
                    </div>
                  ) : (
                    <div key={`note-${entry.rec.id ?? i}`} className="history-item history-item--note">
                      <span className="history-note-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <rect x="9" y="2" width="6" height="11" rx="3" />
                          <path d="M5 10a7 7 0 0014 0" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                          <line x1="9" y1="22" x2="15" y2="22" />
                        </svg>
                      </span>
                      <span className="history-note-text">{entry.rec.text}</span>
                      <span className="history-time">{formatTimestamp(entry.rec.timestamp)}</span>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
