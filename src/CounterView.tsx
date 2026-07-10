import { useState, useCallback, useRef, useEffect } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotesForCounter, addNote, deleteNote } from './db'
import type { Counter } from './db'
import { NoteModal } from './NoteModal'
import { HistoryModal, type HistoryEntry } from './HistoryModal'
import { useTapFeedback } from './useTapFeedback'
import { useEscapeKey } from './useEscapeKey'
import { formatElapsed, exportHistoryTSV } from './utils'
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
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
}


export function CounterView({ counterId, initialHue, prevHue, nextHue, onShowList, onCounterUpdate, onPrev, onNext }: Props) {
  const { count, counter, loading, increment, decrement, undo, canUndo, deleteTap, reset, rename, setStep } = useCounter(counterId)
  const hue = counter ? counterHue(counter) : initialHue
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showNote, setShowNote] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const tapButtonRef = useRef<HTMLButtonElement>(null)

  const triggerFlash = useCallback(() => setFlashKey(k => k + 1), [])
  const { elapsed, setElapsed, streak, lastTapAtRef, lastElapsedUpdateRef, markTap } = useTapFeedback(hue, triggerFlash)

  // Load last tap timestamp on mount
  useEffect(() => {
    if (loading) return
    getTapsForCounter(counterId).then(taps => {
      if (taps.length > 0) {
        lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
        lastElapsedUpdateRef.current = 0
      }
    })
  }, [counterId, loading, lastTapAtRef, lastElapsedUpdateRef])

  const refreshLastTapAt = useCallback(async () => {
    const taps = await getTapsForCounter(counterId)
    if (taps.length > 0) {
      lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
      lastElapsedUpdateRef.current = 0
    } else {
      lastTapAtRef.current = null
      setElapsed(null)
    }
  }, [counterId, lastTapAtRef, lastElapsedUpdateRef, setElapsed])

  const handleTap = useCallback(async () => {
    markTap(1)
    await increment()
  }, [markTap, increment])

  const handleDecrement = useCallback(async () => {
    markTap(-1)
    await decrement()
  }, [markTap, decrement])

  const handleUndo = useCallback(async () => {
    await undo()
    await refreshLastTapAt()
  }, [undo, refreshLastTapAt])

  // Escape closes the settings panel; the note and history modals handle
  // Escape themselves, so stay inactive while either is open.
  useEscapeKey(showSettings && !showNote && !showHistory ? () => setShowSettings(false) : null)

  // Cmd/Ctrl+Z undoes the last tap when no modal is open and focus isn't in
  // a text field (e.g. the rename input).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const target = e.target as Element | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (showNote || showHistory) return
      e.preventDefault()
      handleUndo()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showNote, showHistory, handleUndo])

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
  }, [reset, confirmReset, lastTapAtRef, setElapsed])

  const handleSaveNote = useCallback(async (text: string) => {
    await addNote(text, counterId)
    setShowNote(false)
    requestAnimationFrame(() => window.scrollTo(0, 0))
  }, [counterId])

  const renameSubmittedRef = useRef(false)

  const startRename = useCallback(() => {
    renameSubmittedRef.current = false
    setNameInput(counter?.name ?? '')
    setEditingName(true)
  }, [counter])

  const submitRename = useCallback(async () => {
    // Enter fires form onSubmit, then closing the editor unmounts the input,
    // which fires onBlur — guard against submitting twice.
    if (renameSubmittedRef.current) return
    renameSubmittedRef.current = true
    setEditingName(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== counter?.name) {
      await rename(trimmed)
      if (counter) onCounterUpdate({ ...counter, name: trimmed })
    }
  }, [nameInput, rename, counter, onCounterUpdate])

  const openHistory = useCallback(async () => {
    const [taps, notes] = await Promise.all([
      getTapsForCounter(counterId),
      getNotesForCounter(counterId),
    ])
    const entries: HistoryEntry[] = [
      ...taps.map(rec => ({ kind: 'tap' as const, rec })),
      ...notes.map(rec => ({ kind: 'note' as const, rec })),
    ].sort((a, b) => b.rec.timestamp - a.rec.timestamp)
    setHistory(entries)
    setShowSettings(false)
    setShowHistory(true)
    trackEvent('history-open')
  }, [counterId])

  const handleDeleteEntry = useCallback(async (entry: HistoryEntry) => {
    if (entry.kind === 'tap' && entry.rec.id != null) {
      await deleteTap(entry.rec.id, entry.rec.value)
      await refreshLastTapAt()
    } else if (entry.kind === 'note' && entry.rec.id != null) {
      await deleteNote(entry.rec.id)
    }
  }, [deleteTap, refreshLastTapAt])

  const downloadHistory = useCallback(async () => {
    const name = counter?.name ?? 'Counter'
    const [taps, notes] = await Promise.all([
      getTapsForCounter(counterId),
      getNotesForCounter(counterId),
    ])
    exportHistoryTSV(taps, notes, () => name, `${name.replace(/[^a-z0-9]/gi, '_')}_history.tsv`)
    setShowSettings(false)
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
          <button
            className="edge-peek edge-peek--left"
            style={{ '--peek-hue': prevHue } as React.CSSProperties}
            onClick={onPrev ?? undefined}
            aria-label="Previous counter"
          />
        )}
        {nextHue != null && (
          <button
            className="edge-peek edge-peek--right"
            style={{ '--peek-hue': nextHue } as React.CSSProperties}
            onClick={onNext ?? undefined}
            aria-label="Next counter"
          />
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
          className={`ctrl-btn undo ${!canUndo ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo}
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
