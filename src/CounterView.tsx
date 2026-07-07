import { useState, useCallback, useRef, useEffect } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotes, addNote, deleteNote } from './db'
import type { Counter } from './db'
import { NoteModal } from './NoteModal'
import { HistoryModal, type HistoryEntry } from './HistoryModal'
import { playTap } from './tapSound'
import { useElapsedTimer } from './useElapsedTimer'
import { formatElapsed, downloadAsTSV } from './utils'
import { IconMenu, IconSettings, IconNote, IconDecrement, IconUndo, IconReset, IconChevronRight, IconDownload } from './Icons'
import { trackEvent } from './analytics'
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
  const tapButtonRef = useRef<HTMLButtonElement>(null)
  const [streak, setStreak] = useState(0)
  const streakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { elapsed, setElapsed, lastTapAtRef, lastElapsedUpdateRef } = useElapsedTimer()

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
    trackEvent('history-open')
  }, [counterId, counter])

  const handleDeleteEntry = useCallback(async (entry: HistoryEntry) => {
    if (entry.kind === 'tap' && entry.rec.id != null) {
      await deleteTap(entry.rec.id, entry.rec.value)
      forceUpdate(n => n + 1)
      await refreshLastTapAt()
    } else if (entry.kind === 'note' && entry.rec.id != null) {
      await deleteNote(entry.rec.id)
    }
  }, [deleteTap, refreshLastTapAt])

  const downloadHistory = useCallback(async () => {
    const [taps, notes] = await Promise.all([getTapsForCounter(counterId), getNotes()])
    const name = counter?.name ?? 'Counter'
    const tapRows = taps.map(r => ({ ts: r.timestamp, cols: [name, r.value >= 0 ? 'increment' : 'decrement', String(r.value), ''] }))
    const noteRows = notes.filter(n => n.counterName === name).map(n => ({ ts: n.timestamp, cols: [name, 'note', '', n.text.replace(/\t|\n/g, ' ')] }))
    downloadAsTSV([
      ['Counter', 'Action', 'Value', 'Note', 'Timestamp'].join('\t'),
      ...[...tapRows, ...noteRows].sort((a, b) => a.ts - b.ts).map(r => [...r.cols, new Date(r.ts).toISOString()].join('\t')),
    ], `${name.replace(/[^a-z0-9]/gi, '_')}_history.tsv`)
    trackEvent('download-history')
  }, [counterId, counter])

  if (loading) return <div className="counter-loading" />

  return (
    <div className="counter-view">
      {/* Header + floating settings panel */}
      <div className="counter-top">
      <div className="counter-header">
        <button className="icon-btn" onClick={onShowList} aria-label="Counters">
          <IconMenu />
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
          <IconSettings />
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
                <IconChevronRight className="chevron" />
              </button>
              <button className="settings-row history-btn" onClick={downloadHistory}>
                Download history (.tsv)
                <IconDownload className="chevron" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Count display + tap button */}
      <div className="counter-middle">
        {prevHue != null && (
          <div className="edge-peek edge-peek--left" style={{ '--peek-hue': prevHue } as React.CSSProperties} />
        )}
        {nextHue != null && (
          <div className="edge-peek edge-peek--right" style={{ '--peek-hue': nextHue } as React.CSSProperties} />
        )}
        <div className="count-area">
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
          <IconDecrement />
        </button>

        <button
          className={`ctrl-btn undo ${!canUndo() ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo()}
          aria-label="Undo"
        >
          <IconUndo />
        </button>

        <button className="ctrl-btn note" onClick={() => setShowNote(true)} aria-label="Add note">
          <IconNote />
        </button>

        <button
          className={`ctrl-btn reset ${confirmReset ? 'confirm' : ''}`}
          onClick={handleReset}
          aria-label="Reset"
        >
          {confirmReset ? (
            <span className="reset-confirm-text">Sure?</span>
          ) : (
            <IconReset />
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
        <HistoryModal
          entries={history}
          onDelete={handleDeleteEntry}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
