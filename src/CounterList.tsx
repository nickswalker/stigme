import { useState, useCallback, useRef } from 'react'
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
import { getCounters, getAllTaps, getNotes, clearAllData, type Counter } from './db'
import { getPreferWebSpeech, PREF_KEY, getPreferSound, SOUND_KEY } from './SettingsView'
import { counterHue, hueToHex, hexToHue } from './colors'
import './CounterList.css'

interface Props {
  counters: Counter[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onClose: () => void
  onShowMulti: () => void
  onReorder: (counters: Counter[]) => void
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, hue: number) => void
  wakeLockEnabled: boolean
  onToggleWakeLock: () => void
  onResetAll: () => void
  onShowHelp: () => void
}

interface RowProps {
  counter: Counter
  hue: number
  activeId: string
  editing: boolean
  showDelete: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, hue: number) => void
}

function SortableRow({ counter, hue, activeId, editing, showDelete, onSelect, onDelete, onRename, onRecolor }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: counter.id })
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    '--item-hue': hue,
  } as React.CSSProperties

  function startRename() {
    setNameInput(counter.name)
    setIsRenaming(true)
  }

  function submitRename() {
    setIsRenaming(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== counter.name) onRename(counter.id, trimmed)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`list-item ${counter.id === activeId ? 'active' : ''}`}
    >
      {editing && (
        <span className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <line x1="3" y1="8" x2="21" y2="8" />
            <line x1="3" y1="16" x2="21" y2="16" />
          </svg>
        </span>
      )}
      {editing ? (
        <div className="list-item-main">
          <label className="list-item-dot list-item-dot--pickable" aria-label="Change color">
            <input
              type="color"
              value={hueToHex(hue)}
              onChange={e => onRecolor(counter.id, hexToHue(e.target.value))}
              style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
            />
          </label>
          {isRenaming ? (
            <form onSubmit={e => { e.preventDefault(); submitRename() }} style={{ flex: 1 }}>
              <input
                ref={inputRef}
                className="list-item-rename"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={submitRename}
                autoFocus
              />
            </form>
          ) : (
            <button className="list-item-name-edit" onClick={startRename}>
              {counter.name}
            </button>
          )}
        </div>
      ) : (
        <button className="list-item-main" onClick={() => onSelect(counter.id)}>
          <span className="list-item-dot" />
          <span className="list-item-name">{counter.name}</span>
        </button>
      )}
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

export function CounterList({ counters, activeId, onSelect, onAdd, onDelete, onClose, onShowMulti, onReorder, onRename, onRecolor, wakeLockEnabled, onToggleWakeLock, onResetAll, onShowHelp }: Props) {
  const [editing, setEditing] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [webSpeech, setWebSpeech] = useState(getPreferWebSpeech)
  const [soundEnabled, setSoundEnabled] = useState(getPreferSound)

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

  function toggleWebSpeech() {
    const next = !webSpeech
    setWebSpeech(next)
    localStorage.setItem(PREF_KEY, String(next))
  }

  function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem(SOUND_KEY, String(next))
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

  async function handleResetAll() {
    await clearAllData()
    setShowResetModal(false)
    onResetAll()
  }

  return (
    <div className="counter-list-view">
      <div className="list-header">
        <button className="icon-btn" onClick={editing ? () => setEditing(false) : onClose} aria-label={editing ? 'Done' : 'Close'}>
          {editing ? (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', padding: '0 4px' }}>Done</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>
        <h1 className="list-title">Counters</h1>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {!editing && (
            <>
              <button className="icon-btn" onClick={onAdd} aria-label="Add counter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit counters">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="list-scroll">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={counters.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="list-body">
              {counters.map(c => (
                <SortableRow
                  key={c.id}
                  counter={c}
                  hue={counterHue(c)}
                  activeId={activeId}
                  editing={editing}
                  showDelete={editing && counters.length > 1}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onRename={onRename}
                  onRecolor={onRecolor}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="list-body list-body--special">
          <button className="multi-counter-row" onClick={onShowMulti}>
            <span className="multi-counter-row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1.5" />
              </svg>
            </span>
            <span className="multi-counter-row-label">Multi Counter</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="multi-counter-row-chevron">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="list-settings">
          <div className="list-settings-label">Display</div>
          <button className="settings-toggle-row" onClick={toggleSound}>
            <div className="settings-toggle-text">
              <span className="settings-toggle-title">Tap sounds</span>
              <span className="settings-toggle-desc">
                Plays a tone when tapping. Pitch varies by counter color.
              </span>
            </div>
            <div className={`toggle-switch ${soundEnabled ? 'on' : ''}`} aria-hidden="true">
              <div className="toggle-thumb" />
            </div>
          </button>
          <button className="settings-toggle-row" onClick={onToggleWakeLock}>
            <div className="settings-toggle-text">
              <span className="settings-toggle-title">Keep screen on</span>
              <span className="settings-toggle-desc">
                Prevents the screen from sleeping while counting.
              </span>
            </div>
            <div className={`toggle-switch ${'wakeLock' in navigator ? '' : 'unsupported '}${wakeLockEnabled ? 'on' : ''}`} aria-hidden="true">
              <div className="toggle-thumb" />
            </div>
          </button>

          <div className="list-settings-label" style={{ marginTop: 24 }}>Notes</div>
          <button className="settings-toggle-row" onClick={toggleWebSpeech}>
            <div className="settings-toggle-text">
              <span className="settings-toggle-title">Use Web Speech</span>
              <span className="settings-toggle-desc">
                Auto-starts speech recognition when adding a note, instead of opening the keyboard. May not work as well as your keyboard or OS dictation.
              </span>
            </div>
            <div className={`toggle-switch ${webSpeech ? 'on' : ''}`} aria-hidden="true">
              <div className="toggle-thumb" />
            </div>
          </button>

          <div className="list-settings-label" style={{ marginTop: 24 }}>Data</div>
          <button className="settings-action-row" onClick={downloadAllHistory}>
            <span>Download all history (.tsv)</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button className="settings-action-row settings-action-row--danger" onClick={() => setShowResetModal(true)}>
            Reset all data
          </button>

          <div className="list-settings-label" style={{ marginTop: 24 }}>About</div>
          <button className="settings-action-row" onClick={onShowHelp}>
            <span>How to use</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <a className="settings-action-row" href="https://github.com/nickswalker/stigme" target="_blank" rel="noopener noreferrer">
            <span>Code</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      {showResetModal && (
        <div className="list-modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="list-modal" onClick={e => e.stopPropagation()}>
            <div className="list-modal-header">
              <h2>Reset all data?</h2>
            </div>
            <p className="list-modal-body">This will clear the count and all history for every counter. This cannot be undone.</p>
            <div className="list-modal-actions">
              <button className="list-modal-btn" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button className="list-modal-btn list-modal-btn--danger" onClick={handleResetAll}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
