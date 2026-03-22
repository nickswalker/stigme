import { useState, useEffect, useRef, useCallback } from 'react'
import { getPreferWebSpeech } from './SettingsView'
import './NoteModal.css'

interface Props {
  onSave: (text: string) => void
  onClose: () => void
}

const SpeechRecognitionAPI =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
const speechSupported = !!SpeechRecognitionAPI

export function NoteModal({ onSave, onClose }: Props) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const recogRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const stopListening = useCallback(() => {
    recogRef.current?.stop()
  }, [])

  const startListening = useCallback(() => {
    const recog = new SpeechRecognitionAPI()
    recog.continuous = false
    recog.interimResults = true
    recog.onstart = () => setListening(true)
    recog.onresult = (e: any) => {
      const transcript = Array.from(e.results as SpeechRecognitionResultList)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join('')
      setText(transcript)
    }
    recog.onend = () => setListening(false)
    recog.onerror = () => setListening(false)
    recogRef.current = recog
    recog.start()
  }, [])

  useEffect(() => {
    if (speechSupported && getPreferWebSpeech()) {
      startListening()
    } else {
      textareaRef.current?.focus()
    }
    return () => recogRef.current?.abort()
  }, [startListening])

  const handleSave = useCallback(() => {
    stopListening()
    const trimmed = text.trim()
    if (trimmed) onSave(trimmed)
    else onClose()
  }, [text, onSave, onClose, stopListening])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
    if (e.key === 'Escape') onClose()
  }, [handleSave, onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal note-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Note</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="note-body">
          <textarea
            ref={textareaRef}
            className="note-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={speechSupported && getPreferWebSpeech() ? 'Listening… or type here' : 'Type a note…'}
          />
          {speechSupported && (
            <button
              className={`mic-btn ${listening ? 'listening' : ''}`}
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'Stop listening' : 'Start listening'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </button>
          )}
        </div>

        <div className="note-actions">
          <button className="note-btn cancel" onClick={onClose}>Cancel</button>
          <button className="note-btn save" onClick={handleSave} disabled={!text.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
