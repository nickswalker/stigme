import { useState, useCallback, useEffect } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotesForCounter, addNote, removeTap, deleteNote, type Counter } from './db'
import { HistoryModal, type HistoryEntry } from './HistoryModal'
import { NoteModal } from './NoteModal'
import { counterHue } from './colors'
import { useTapFeedback } from './useTapFeedback'
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
}

interface CellProps {
  counter: Counter
  onFlash: (hue: number) => void
}

function MultiCounterCell({ counter, onFlash }: CellProps) {
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

  const handleTap = useCallback(async () => {
    markTap(1)
    await increment()
  }, [markTap, increment])

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
      <div className="cell-main">
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
      </div>
      <div className="cell-controls">
        <button className="cell-ctrl" onClick={handleDecrement} aria-label="Decrement">
          <IconDecrement />
        </button>
        <button
          className={`cell-ctrl ${!canUndo ? 'disabled' : ''}`}
          onClick={() => undo()}
          disabled={!canUndo}
          aria-label="Undo"
        >
          <IconUndo />
        </button>
        <button className="cell-ctrl" onClick={() => setShowNote(true)} aria-label="Add note">
          <IconNote />
        </button>
      </div>
      {showNote && <NoteModal onSave={handleSaveNote} onClose={() => setShowNote(false)} />}
    </div>
  )
}


export function MultiCounterView({ counters, multiViewIds, onMultiViewIdsChange, onShowList }: Props) {
  const [editing, setEditing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [flashState, setFlashState] = useState<{ key: number; hue: number }>({ key: 0, hue: 0 })
  // Bumped after out-of-band tap deletions to remount cells so their counts and
  // undo stacks reload rather than showing stale values.
  const [refreshKey, setRefreshKey] = useState(0)

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
        {Array.from({ length: totalSlots }, (_, slot) => {
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
                  onFlash={handleFlash}
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
                  <IconPlus width="32" height="32" />
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
                <IconClose />
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
        <HistoryModal
          entries={history}
          onDelete={handleDeleteEntry}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
