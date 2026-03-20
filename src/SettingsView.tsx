import { useState, useCallback } from 'react'
import { getCounters, getAllTaps, getNotes } from './db'
import './SettingsView.css'

const PREF_KEY = 'preferKeyboardDictation'

export function getPreferKeyboardDictation(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true'
}

interface Props {
  onClose: () => void
}

export function SettingsView({ onClose }: Props) {
  const [keyboardDictation, setKeyboardDictation] = useState(getPreferKeyboardDictation)

  const downloadAllHistory = useCallback(async () => {
    const [counters, taps, notes] = await Promise.all([getCounters(), getAllTaps(), getNotes()])
    const counterMap = new Map(counters.map(c => [c.id, c.name]))
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

  function toggleKeyboardDictation() {
    const next = !keyboardDictation
    setKeyboardDictation(next)
    localStorage.setItem(PREF_KEY, String(next))
  }

  return (
    <div className="settings-view">
      <div className="list-header">
        <button className="icon-btn" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="list-title">Settings</h1>
        <div style={{ width: 44 }} />
      </div>

      <div className="settings-view-body">
        <div className="settings-section-label">Data</div>

        <button className="settings-action-row" onClick={downloadAllHistory}>
          <span>Download all history (.tsv)</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <div className="settings-section-label" style={{ marginTop: 24 }}>Notes</div>

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
  )
}
