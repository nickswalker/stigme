import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getCounters, getAllTaps, getNotes, type Counter } from './db'
import { getPreferKeyboardDictation, PREF_KEY } from './SettingsView'
import { BUTTON_HUES } from './colors'
import './CounterList.css'

interface Props {
  counters: Counter[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onClose: () => void
  onReorder: (counters: Counter[]) => void
}

interface RowProps {
  counter: Counter
  colorIndex: number
  activeId: string
  reordering: boolean
  showDelete: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function SortableRow({ counter, colorIndex, activeId, reordering, showDelete, onSelect, onDelete }: RowProps) {
  const hue = BUTTON_HUES[colorIndex % BUTTON_HUES.length]
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: counter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    '--item-hue': hue,
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`list-item ${counter.id === activeId ? 'active' : ''}`}
    >
      {reordering && (
        <span className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <line x1="3" y1="8" x2="21" y2="8" />
            <line x1="3" y1="16" x2="21" y2="16" />
          </svg>
        </span>
      )}
      <button className="list-item-main" onClick={() => !reordering && onSelect(counter.id)}>
        <span className="list-item-dot" />
        <span className="list-item-name">{counter.name}</span>
      </button>
      {showDelete && (
        <button
          className="list-delete-btn"
          onClick={() => onDelete(counter.id)}
          aria-label={`Delete ${counter.name}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      )}
    </div>
  )
}

export function CounterList({ counters, activeId, onSelect, onAdd, onDelete, onClose, onReorder }: Props) {
  const [reordering, setReordering] = useState(false)
  const [keyboardDictation, setKeyboardDictation] = useState(getPreferKeyboardDictation)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = counters.findIndex(c => c.id === active.id)
    const newIndex = counters.findIndex(c => c.id === over.id)
    const reordered = arrayMove(counters, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }))
    onReorder(reordered)
  }

  function toggleKeyboardDictation() {
    const next = !keyboardDictation
    setKeyboardDictation(next)
    localStorage.setItem(PREF_KEY, String(next))
  }

  const downloadAllHistory = useCallback(async () => {
    const [allCounters, taps, notes] = await Promise.all([getCounters(), getAllTaps(), getNotes()])
    const counterMap = new Map(allCounters.map(c => [c.id, c.name]))
    const tapRows = taps.map(r => ({
      ts: r.timestamp,
      cols: [counterMap.get(r.counterId) ?? r.counterId, r.value >= 0 ? 'increment' : 'decrement', String(r.value), ''],
    }))
    const noteRows = notes.map(n => ({
      ts: n.timestamp,
      cols: [n.counterName, 'note', '', n.text.replace(/\t|\n/g, ' ')],
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
    a.download = 'all_history.tsv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="counter-list-view">
      <div className="list-header">
        <button className="icon-btn" onClick={reordering ? () => setReordering(false) : onClose} aria-label={reordering ? 'Done' : 'Close'}>
          {reordering ? (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', padding: '0 4px' }}>Done</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>
        <h1 className="list-title">Counters</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {!reordering && (
            <>
              <button className="icon-btn" onClick={onAdd} aria-label="Add counter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {counters.length > 1 && (
                <button className="icon-btn" onClick={() => setReordering(true)} aria-label="Reorder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                    <polyline points="17 3 21 6 17 9" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="list-scroll">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={counters.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="list-body">
              {counters.map((c, i) => (
                <SortableRow
                  key={c.id}
                  counter={c}
                  colorIndex={c.colorIndex ?? i}
                  activeId={activeId}
                  reordering={reordering}
                  showDelete={!reordering && counters.length > 1}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="list-settings">
          <div className="list-settings-label">Data</div>
          <button className="settings-action-row" onClick={downloadAllHistory}>
            <span>Download all history (.tsv)</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <div className="list-settings-label" style={{ marginTop: 24 }}>Notes</div>
          <button className="settings-toggle-row" onClick={toggleKeyboardDictation}>
            <div className="settings-toggle-text">
              <span className="settings-toggle-title">Use keyboard dictation</span>
              <span className="settings-toggle-desc">
                Opens the keyboard instead of auto-starting Web Speech. Tap the mic on your keyboard to dictate.
              </span>
            </div>
            <div className={`toggle-switch ${keyboardDictation ? 'on' : ''}`} aria-hidden="true">
              <div className="toggle-thumb" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
