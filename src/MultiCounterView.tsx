import { useState, useCallback, useEffect, useRef } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotesForCounter, getCount, addNote, removeTap, deleteNote, type Counter } from './db'
import { HistoryModal, type HistoryEntry } from './HistoryModal'
import { NoteModal } from './NoteModal'
import { counterHue } from './colors'
import { useTapFeedback } from './useTapFeedback'
import { useEscapeKey } from './useEscapeKey'
import { formatElapsed, exportHistoryTSV } from './utils'
import { IconMenu, IconSettings, IconEdit, IconClose, IconChevronRight, IconDownload, IconDecrement, IconUndo, IconNote, IconPlus } from './Icons'
import { trackEvent } from './analytics'
import './MultiCounterView.css'
import './CounterView.css'

interface Props {
  counters: Counter[]
  multiViewIds: string[]
  onMultiViewIdsChange: (ids: string[]) => void
  onShowList: () => void
  onCreateCounter: () => Promise<Counter>
}

interface CellProps {
  counter: Counter
  editing: boolean
  onFlash: (hue: number) => void
  registerTap: (id: string, fn: (() => void) | null) => void
}

function MultiCounterCell({ counter, editing, onFlash, registerTap }: CellProps) {
  const hue = counterHue(counter)
  const { count, loading, increment, decrement, undo, canUndo } = useCounter(counter.id)
  const [showNote, setShowNote] = useState(false)
  const triggerFlash = useCallback(() => onFlash(hue), [onFlash, hue])
  const { elapsed, streak, lastTapAtRef, lastElapsedUpdateRef, markTap } = useTapFeedback(hue, triggerFlash)

  useEffect(() => {
    if (loading) return
    getTapsForCounter(counter.id).then(taps => {
      if (taps.length > 0) {
        lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
        lastElapsedUpdateRef.current = 0
      }
    })
  }, [counter.id, loading, lastTapAtRef, lastElapsedUpdateRef])

  // Taps are disabled in edit mode so rearranging/removing doesn't miscount.
  const handleTap = useCallback(async () => {
    if (editing) return
    markTap(1)
    await increment()
  }, [editing, markTap, increment])

  // Expose this cell's tap handler to the parent so digit keys can drive it.
  useEffect(() => {
    registerTap(counter.id, handleTap)
    return () => registerTap(counter.id, null)
  }, [counter.id, handleTap, registerTap])

  const handleDecrement = useCallback(async () => {
    markTap(-1)
    await decrement()
  }, [markTap, decrement])

  const handleSaveNote = useCallback(async (text: string) => {
    await addNote(text, counter.id)
    setShowNote(false)
  }, [counter.id])

  if (loading) return <div className="cell-loading" />

  return (
    <div className="multi-cell">
      {/* The whole main area is an increment surface; the button stays the
          accessible control and stops propagation so a press counts once. */}
      <div className="cell-main" onClick={editing ? undefined : handleTap}>
        <div className="cell-count">{count.toLocaleString()}</div>
        {elapsed != null && <div className="cell-elapsed">{formatElapsed(elapsed)}</div>}
        <button
          className="cell-tap-btn"
          style={{ '--btn-hue': hue } as React.CSSProperties}
          onClick={e => { e.stopPropagation(); handleTap() }}
          aria-label={`Tap ${counter.name}`}
        >
          <span className="cell-name">{counter.name}</span>
          {streak >= 2 && <span className="cell-streak">×{streak}</span>}
        </button>
      </div>
      <div className="cell-controls">
        <button className="cell-ctrl" onClick={handleDecrement} aria-label={`Decrement ${counter.name}`}>
          <IconDecrement />
        </button>
        <button
          className={`cell-ctrl ${!canUndo ? 'disabled' : ''}`}
          onClick={() => undo()}
          disabled={!canUndo}
          aria-label={`Undo last tap on ${counter.name}`}
        >
          <IconUndo />
        </button>
        <button className="cell-ctrl" onClick={() => setShowNote(true)} aria-label={`Add note to ${counter.name}`}>
          <IconNote />
        </button>
      </div>
      {showNote && <NoteModal onSave={handleSaveNote} onClose={() => setShowNote(false)} />}
    </div>
  )
}


export function MultiCounterView({ counters, multiViewIds, onMultiViewIdsChange, onShowList, onCreateCounter }: Props) {
  const [editing, setEditing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [flashState, setFlashState] = useState<{ key: number; hue: number }>({ key: 0, hue: 0 })
  const [pickerCounts, setPickerCounts] = useState<Record<string, number>>({})
  // Bumped after out-of-band tap deletions to remount cells so their counts and
  // undo stacks reload rather than showing stale values.
  const [refreshKey, setRefreshKey] = useState(0)

  const cells = multiViewIds
    .map(id => counters.find(c => c.id === id))
    .filter(Boolean) as Counter[]

  const is2up = cells.length <= 2 && !editing
  const totalSlots = is2up ? 2 : 4
  const availableToAdd = counters.filter(c => !multiViewIds.includes(c.id))

  // Maps a visible cell's id to its tap handler so digit keys 1–4 can drive
  // the cell in the corresponding slot without re-rendering the cells.
  const cellTaps = useRef<Map<string, () => void>>(new Map())
  const registerTap = useCallback((id: string, fn: (() => void) | null) => {
    if (fn) cellTaps.current.set(id, fn)
    else cellTaps.current.delete(id)
  }, [])

  const handleFlash = useCallback((hue: number) => {
    setFlashState(s => ({ key: s.key + 1, hue }))
  }, [])

  // Load current counts for the picker when it opens (dim/small per-row info).
  useEffect(() => {
    if (!showPicker) return
    let cancelled = false
    Promise.all(availableToAdd.map(async c => [c.id, await getCount(c.id)] as const))
      .then(entries => { if (!cancelled) setPickerCounts(Object.fromEntries(entries)) })
    return () => { cancelled = true }
    // Reload only on open; availableToAdd changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker])

  // Escape closes the topmost open surface here; the history and note modals
  // handle Escape themselves (so stay inactive while a history modal is open).
  useEscapeKey(
    showHistory ? null
      : showPicker ? () => setShowPicker(false)
      : showSettings ? () => setShowSettings(false)
      : null
  )

  const handleAdd = useCallback((id: string) => {
    if (multiViewIds.length >= 4) return
    onMultiViewIdsChange([...multiViewIds, id])
    setShowPicker(false)
  }, [multiViewIds, onMultiViewIdsChange])

  const handleCreateNew = useCallback(async () => {
    if (multiViewIds.length >= 4) return
    const counter = await onCreateCounter()
    onMultiViewIdsChange([...multiViewIds, counter.id])
    setShowPicker(false)
  }, [multiViewIds, onMultiViewIdsChange, onCreateCounter])

  const handleRemove = useCallback((id: string) => {
    onMultiViewIdsChange(multiViewIds.filter(x => x !== id))
  }, [multiViewIds, onMultiViewIdsChange])

  // Digit keys 1–4 increment the cell in the matching slot. Ignored while a
  // modal/picker is open, in edit mode, or when focus is in a text field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key < '1' || e.key > '4') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (editing || showPicker || showSettings || showHistory) return
      const target = e.target as Element | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (document.querySelector('.modal-overlay')) return
      const cell = cells[Number(e.key) - 1]
      if (!cell) return
      const fn = cellTaps.current.get(cell.id)
      if (fn) { e.preventDefault(); fn() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cells, editing, showPicker, showSettings, showHistory])

  const openHistory = useCallback(async () => {
    const counterMap = new Map(counters.map(c => [c.id, c]))
    const [allTaps, allNotes] = await Promise.all([
      Promise.all(cells.map(c => getTapsForCounter(c.id))).then(r => r.flat()),
      Promise.all(cells.map(c => getNotesForCounter(c.id))).then(r => r.flat()),
    ])
    const identify = (counterId: string) => {
      const c = counterMap.get(counterId)
      return { counterName: c?.name ?? counterId, counterHue: counterHue(c) }
    }
    const entries: HistoryEntry[] = [
      ...allTaps.map(rec => ({ kind: 'tap' as const, rec, ...identify(rec.counterId) })),
      ...allNotes.map(rec => ({ kind: 'note' as const, rec, ...identify(rec.counterId) })),
    ].sort((a, b) => b.rec.timestamp - a.rec.timestamp)
    setHistory(entries)
    setShowSettings(false)
    setShowHistory(true)
    trackEvent('multi-history-open')
  }, [cells, counters])

  const handleDeleteEntry = useCallback(async (entry: HistoryEntry) => {
    if (entry.kind === 'tap' && entry.rec.id != null) {
      await removeTap(entry.rec.id)
    } else if (entry.kind === 'note' && entry.rec.id != null) {
      await deleteNote(entry.rec.id)
    }
    // Reload cells so a deleted tap doesn't leave a stale count or a dangling
    // reference on any cell's undo stack.
    setRefreshKey(k => k + 1)
  }, [])

  const downloadHistory = useCallback(async () => {
    const counterMap = new Map(counters.map(c => [c.id, c.name]))
    const [allTaps, allNotes] = await Promise.all([
      Promise.all(cells.map(c => getTapsForCounter(c.id))).then(r => r.flat()),
      Promise.all(cells.map(c => getNotesForCounter(c.id))).then(r => r.flat()),
    ])
    exportHistoryTSV(
      allTaps,
      allNotes,
      id => counterMap.get(id) ?? id,
      'multi_counter_history.tsv',
    )
    setShowSettings(false)
    trackEvent('download-multi-history')
  }, [cells, counters])



  return (
    <div className="multi-view">
      {/* Header */}
      <div className="counter-top">
        <div className="multi-header">
          <button className="icon-btn" onClick={onShowList} aria-label="Back to list">
            <IconMenu />
          </button>
          <h1 className="multi-title">Multi Counter</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {multiViewIds.length < 4 && !editing && (
              <button className="icon-btn" onClick={() => setShowPicker(true)} aria-label="Add counter to view">
                <IconPlus />
              </button>
            )}
            <button className="icon-btn" onClick={() => { setShowSettings(s => !s); setEditing(false) }} aria-label="Settings">
              <IconSettings />
            </button>
            <button className="icon-btn" onClick={() => { setEditing(e => !e); setShowSettings(false) }} aria-label={editing ? 'Done' : 'Edit'}>
              {editing
                ? <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', padding: '0 4px' }}>Done</span>
                : <IconEdit />
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

      {/* Grid: 2-up (1 row) or 4-up (2 rows) based on cell count */}
      <div className={`multi-grid ${is2up ? 'multi-grid--2up' : 'multi-grid--4up'}`}>
        {cells.length === 0 ? (
          <button
            className="multi-slot multi-slot--empty multi-slot--full"
            onClick={() => setShowPicker(true)}
            aria-label="Add counter"
          >
            <span className="add-slot-icon">
              <IconPlus width="40" height="40" />
            </span>
            <span className="add-slot-copy">Count up to four things side by side</span>
          </button>
        ) : Array.from({ length: totalSlots }, (_, slot) => {
          const counter = cells[slot]
          if (counter) {
            return (
              <div key={counter.id} className="multi-slot">
                {editing && (
                  <button className="cell-remove-btn" onClick={() => handleRemove(counter.id)} aria-label={`Remove ${counter.name}`}>
                    <IconClose width="16" height="16" strokeWidth={2.5} />
                  </button>
                )}
                <MultiCounterCell
                  key={`${counter.id}-${refreshKey}`}
                  counter={counter}
                  editing={editing}
                  onFlash={handleFlash}
                  registerTap={registerTap}
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
                <>
                  <span className="add-slot-icon">
                    <IconPlus width="32" height="32" />
                  </span>
                  <span className="add-slot-label">Add counter</span>
                </>
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
                <IconClose />
              </button>
            </div>
            <div className="picker-list">
              {availableToAdd.length === 0 && (
                <p className="empty-msg">All counters are already shown</p>
              )}
              {availableToAdd.map(c => (
                <button key={c.id} className="picker-item" onClick={() => handleAdd(c.id)}>
                  <span className="picker-dot" style={{ background: `hsl(${counterHue(c)}, 70%, 58%)` }} />
                  <span className="picker-name">{c.name}</span>
                  <span className="picker-count">{(pickerCounts[c.id] ?? 0).toLocaleString()}</span>
                </button>
              ))}
              <button className="picker-item picker-item--new" onClick={handleCreateNew}>
                <span className="picker-new-icon"><IconPlus width="14" height="14" /></span>
                <span className="picker-name">New counter</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
