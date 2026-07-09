import { useState, useRef } from 'react'
import type { TapRecord, NoteRecord } from './db'
import { IconClose, IconNoteDoc } from './Icons'

export type HistoryEntry =
  | { kind: 'tap'; rec: TapRecord; counterName?: string; counterHue?: number }
  | { kind: 'note'; rec: NoteRecord; counterName?: string; counterHue?: number }

interface Props {
  entries: HistoryEntry[]
  onDelete: (entry: HistoryEntry) => Promise<void>
  onClose: () => void
}

type DayGroup = { label: string; entries: HistoryEntry[]; showSeconds: boolean }

function groupByDay(entries: HistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = []
  let currentKey = ''
  let currentGroup: DayGroup | null = null
  for (const entry of entries) {
    const d = new Date(entry.rec.timestamp)
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (dayKey !== currentKey) {
      currentKey = dayKey
      currentGroup = {
        label: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
        entries: [],
        showSeconds: false,
      }
      groups.push(currentGroup)
    }
    currentGroup!.entries.push(entry)
  }
  for (const group of groups) {
    const ts = group.entries.map(e => e.rec.timestamp)
    for (let i = 1; i < ts.length; i++) {
      if (Math.abs(ts[i - 1] - ts[i]) < 60_000) { group.showSeconds = true; break }
    }
  }
  return groups
}

function formatTimeOnly(ts: number, showSeconds: boolean): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    timeStyle: showSeconds ? 'medium' : 'short',
  })
}

export function HistoryModal({ entries: initialEntries, onDelete, onClose }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [swipedKey, setSwipedKey] = useState<string | null>(null)
  const rowTouchRef = useRef<{ startX: number; startY: number; key: string } | null>(null)

  async function handleDelete(entry: HistoryEntry) {
    await onDelete(entry)
    setEntries(prev => prev.filter(e => e !== entry))
    setSwipedKey(null)
  }

  function onRowTouchStart(e: React.TouchEvent, key: string) {
    const t = e.touches[0]
    rowTouchRef.current = { startX: t.clientX, startY: t.clientY, key }
  }

  function onRowTouchMove(e: React.TouchEvent) {
    if (!rowTouchRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - rowTouchRef.current.startX
    const dy = t.clientY - rowTouchRef.current.startY
    if (Math.abs(dy) > Math.abs(dx) + 5) { rowTouchRef.current = null; return }
    const { key } = rowTouchRef.current
    if (dx < -40) setSwipedKey(key)
    else if (dx > 10 && swipedKey === key) setSwipedKey(null)
  }

  function onRowTouchEnd() { rowTouchRef.current = null }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>History</h2>
          <button className="icon-btn" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div className="history-list" onClick={() => setSwipedKey(null)}>
          {entries.length === 0 ? (
            <p className="empty-msg">No history yet</p>
          ) : (
            groupByDay(entries).map((group, gi) =>
              <div key={group.label} className="history-day-group">
                <div className="history-day-header">{group.label}</div>
                {group.entries.map((entry, i) => {
                  const key = entry.kind === 'tap'
                    ? `tap-${entry.rec.id}`
                    : `note-${entry.rec.id ?? gi * 1000 + i}`
                  const swiped = swipedKey === key
                  const showIdentity = entry.counterHue != null
                  const dotStyle = showIdentity
                    ? { background: `hsl(${entry.counterHue}, 70%, 58%)` }
                    : undefined
                  const identityName = entry.counterName
                  return (
                    <div
                      key={key}
                      className="history-item-wrap"
                      onTouchStart={e => onRowTouchStart(e, key)}
                      onTouchMove={onRowTouchMove}
                      onTouchEnd={onRowTouchEnd}
                    >
                      {entry.kind === 'tap' ? (
                        <div className={`history-item${swiped ? ' swiped' : ''}`}>
                          {showIdentity && (
                            <span className="history-counter-identity">
                              <span className="history-counter-dot" style={dotStyle} />
                              <span className="history-counter-name">{identityName}</span>
                            </span>
                          )}
                          <span className={`history-value ${entry.rec.value >= 0 ? 'positive' : 'negative'}`}>
                            {entry.rec.value >= 0 ? '+' : ''}{entry.rec.value}
                          </span>
                          <span className="history-time">{formatTimeOnly(entry.rec.timestamp, group.showSeconds)}</span>
                        </div>
                      ) : (
                        <div className={`history-item history-item--note${swiped ? ' swiped' : ''}`}>
                          {showIdentity && (
                            <span className="history-counter-identity">
                              <span className="history-counter-dot" style={dotStyle} />
                              <span className="history-counter-name">{identityName}</span>
                            </span>
                          )}
                          <span className="history-note-icon">
                            <IconNoteDoc width="14" height="14" />
                          </span>
                          <span className="history-note-text">{entry.rec.text}</span>
                          <span className="history-time">{formatTimeOnly(entry.rec.timestamp, group.showSeconds)}</span>
                        </div>
                      )}
                      <button
                        className="history-delete-btn"
                        onClick={e => { e.stopPropagation(); handleDelete(entry) }}
                        aria-label="Delete entry"
                      >
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
