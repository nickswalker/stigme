import { useState } from 'react'
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
        <div className="settings-section-label">Notes</div>

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
