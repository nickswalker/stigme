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
}

export function CounterList({ counters, activeId, onSelect, onAdd, onDelete, onClose }: Props) {
  return (
    <div className="counter-list-view">
      <div className="list-header">
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="list-title">Counters</h1>
        <button className="icon-btn" onClick={onAdd} aria-label="Add counter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="list-body">
        {counters.map((c, i) => {
          const hue = BUTTON_HUES[i % BUTTON_HUES.length]
          return (
          <div
            key={c.id}
            className={`list-item ${c.id === activeId ? 'active' : ''}`}
            style={{ '--item-hue': hue } as React.CSSProperties}
          >
            <button className="list-item-main" onClick={() => onSelect(c.id)}>
              <span className="list-item-dot" />
              <span className="list-item-name">{c.name}</span>
            </button>
            {counters.length > 1 && (
              <button
                className="list-delete-btn"
                onClick={() => onDelete(c.id)}
                aria-label={`Delete ${c.name}`}
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
        })}
      </div>
    </div>
  )
}
