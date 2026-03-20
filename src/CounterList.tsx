import { useState } from 'react'
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
import type { Counter } from './db'
import { BUTTON_HUES } from './colors'
import './CounterList.css'

interface Props {
  counters: Counter[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onClose: () => void
  onShowSettings: () => void
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

export function CounterList({ counters, activeId, onSelect, onAdd, onDelete, onClose, onShowSettings, onReorder }: Props) {
  const [reordering, setReordering] = useState(false)

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

  return (
    <div className="counter-list-view">
      <div className="list-header">
        <button className="icon-btn" onClick={reordering ? () => setReordering(false) : onClose} aria-label={reordering ? 'Done' : 'Close'}>
          {reordering ? (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', padding: '0 4px' }}>Done</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
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
              <button className="icon-btn" onClick={onShowSettings} aria-label="Settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={counters.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="list-body">
            {counters.map((c, i) => (
              <SortableRow
                key={c.id}
                counter={c}
                colorIndex={i}
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
    </div>
  )
}
