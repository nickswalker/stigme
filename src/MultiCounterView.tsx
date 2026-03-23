import { useState, useCallback, useEffect, useRef } from 'react'
import { useCounter } from './useCounter'
import { getTapsForCounter, getNotes, addNote, removeTap, deleteNote, type Counter } from './db'
import { HistoryModal, type HistoryEntry } from './HistoryModal'
import { NoteModal } from './NoteModal'
import { playTap } from './tapSound'
import { counterHue } from './colors'
import { useElapsedTimer } from './useElapsedTimer'
import { formatElapsed, downloadAsTSV } from './utils'
import { IconMenu, IconSettings, IconEdit, IconClose, IconChevronRight, IconDownload, IconDecrement, IconUndo, IconNote, IconPlus } from './Icons'
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

function MultiCounterCell({ counter, onFlash, onCounterUpdate }: CellProps) {
  const hue = counterHue(counter)
  const { count, loading, increment, decrement, undo, canUndo } = useCounter(counter.id)
  const [showNote, setShowNote] = useState(false)
  const [, forceUpdate] = useState(0)
  const [streak, setStreak] = useState(0)
  const streakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { elapsed, setElapsed, lastTapAtRef, lastElapsedUpdateRef } = useElapsedTimer()

  useEffect(() => {
    if (loading) return
    getTapsForCounter(counter.id).then(taps => {
      if (taps.length > 0) {
        lastTapAtRef.current = Math.max(...taps.map(t => t.timestamp))
      }
    })
  }, [counter.id, loading])

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
          className={`cell-ctrl ${!canUndo() ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo()}
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

  const handleDeleteEntry = useCallback(async (entry: HistoryEntry) => {
    if (entry.kind === 'tap' && entry.rec.id != null) {
      await removeTap(entry.rec.id)
    } else if (entry.kind === 'note' && entry.rec.id != null) {
      await deleteNote(entry.rec.id)
    }
  }, [])

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
    downloadAsTSV([
      ['Counter', 'Action', 'Value', 'Note', 'Timestamp'].join('\t'),
      ...[...tapRows, ...noteRows]
        .sort((a, b) => a.ts - b.ts)
        .map(r => [...r.cols, new Date(r.ts).toISOString()].join('\t')),
    ], 'multi_counter_history.tsv')
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
