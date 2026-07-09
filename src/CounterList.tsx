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
import { getCounters, getAllTaps, getNotes, type Counter } from './db'
import { getPreferWebSpeech, setPreferWebSpeech, getPreferSound, setPreferSound } from './preferences'
import { counterHue, hueToHex, hexToHue } from './colors'
import { exportHistoryTSV } from './utils'
import { IconClose, IconPlus, IconEdit, IconTrash, IconDragHandle, IconDownload, IconChevronRight, IconExternalLink, IconMultiGrid } from './Icons'
import { trackEvent } from './analytics'
import './CounterList.css'

const PWA_PROMPT_KEY = 'pwa-prompt-dismissed'
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}
// Only surface "Add to Home Screen" on touch-first devices.
function isMobileish() {
  return window.matchMedia('(pointer: coarse)').matches
}

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
  fromMulti: boolean
  multiViewIds: string[]
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
          <IconDragHandle width="20" height="20" />
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
          <IconTrash />
        </button>
      )}
    </div>
  )
}

export function CounterList({ counters, activeId, onSelect, onAdd, onDelete, onClose, onShowMulti, onReorder, onRename, onRecolor, wakeLockEnabled, onToggleWakeLock, onResetAll, onShowHelp, fromMulti, multiViewIds }: Props) {
  const [editing, setEditing] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [webSpeech, setWebSpeech] = useState(getPreferWebSpeech)
  const [soundEnabled, setSoundEnabled] = useState(getPreferSound)
  const [showInstallPrompt, setShowInstallPrompt] = useState(
    () => !isStandalone() && isMobileish() && !localStorage.getItem(PWA_PROMPT_KEY)
  )

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
    setPreferWebSpeech(next)
  }

  function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    setPreferSound(next)
  }

  const downloadAllHistory = useCallback(async () => {
    const [allCounters, taps, notes] = await Promise.all([getCounters(), getAllTaps(), getNotes()])
    const counterMap = new Map(allCounters.map(c => [c.id, c.name]))
    exportHistoryTSV(taps, notes, id => counterMap.get(id) ?? id, 'all_history.tsv')
    trackEvent('download-all-history')
  }, [])

  function handleResetAll() {
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
            <IconClose />
          )}
        </button>
        <h1 className="list-title">Counters</h1>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {!editing && (
            <>
              <button className="icon-btn" onClick={onAdd} aria-label="Add counter">
                <IconPlus />
              </button>
              <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit counters">
                <IconEdit />
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
                  activeId={fromMulti ? '' : activeId}
                  editing={editing}
                  showDelete={editing && counters.length > 1}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onRename={onRename}
                  onRecolor={onRecolor}
                />
              ))}
              <div className="list-item">
                <button className={`multi-counter-row${fromMulti ? ' active' : ''}`} onClick={onShowMulti}>
                  <span className="multi-counter-row-icon" style={{ opacity: fromMulti ? 1 : 0.5 }}>
                    <IconMultiGrid
                      width="20" height="20"
                      slots={[0, 1, 2, 3].map(i => {
                        const c = counters.find(c => c.id === multiViewIds[i])
                        return c ? `hsl(${counterHue(c)}, 70%, 58%)` : ''
                      })}
                    />
                  </span>
                  <span className="multi-counter-row-label">Multi Counter</span>
                  <IconChevronRight width="16" height="16" className="multi-counter-row-chevron" />
                </button>
              </div>
            </div>
          </SortableContext>
        </DndContext>

        {showInstallPrompt && (
          <div className="install-prompt">
            <div className="install-prompt-text">
              <strong>Add to Home Screen</strong>
              <span>Install for full-screen use and faster launch.</span>
            </div>
            <div className="install-prompt-actions">
              <button className="install-prompt-how" onClick={onShowHelp}>How?</button>
              <button className="install-prompt-dismiss" onClick={() => {
                localStorage.setItem(PWA_PROMPT_KEY, '1')
                setShowInstallPrompt(false)
              }} aria-label="Dismiss">
                <IconClose width="14" height="14" />
              </button>
            </div>
          </div>
        )}

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
            <IconDownload width="18" height="18" />
          </button>
          <button className="settings-action-row settings-action-row--danger" onClick={() => setShowResetModal(true)}>
            Reset all data
          </button>

          <div className="list-settings-label" style={{ marginTop: 24 }}>About</div>
          <button className="settings-action-row" onClick={onShowHelp}>
            <span>How to use</span>
            <IconChevronRight className="chevron" />
          </button>
          <a className="settings-action-row" href="https://github.com/nickswalker/stigme" target="_blank" rel="noopener noreferrer">
            <span>Code</span>
            <IconExternalLink width="18" height="18" />
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
