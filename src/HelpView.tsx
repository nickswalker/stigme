import { IconChevronLeft } from './Icons'
import './HelpView.css'

interface Props {
  onClose: () => void
}

export function HelpView({ onClose }: Props) {
  return (
    <div className="help-view">
      <div className="help-header">
        <button className="icon-btn" onClick={onClose} aria-label="Back">
          <IconChevronLeft />
        </button>
        <h1 className="help-title">How to use</h1>
        <div style={{ width: 38 }} />
      </div>

      <div className="help-scroll">
        <section className="help-section">
          <h2>Counter</h2>
          <p>Tap the big button to count. The number and a timestamp are recorded each tap.</p>
          <p>Below the button are controls to <strong>decrement</strong>, <strong>undo</strong> the last action, add a text <strong>note</strong>, or <strong>reset</strong> the count (tap reset twice to confirm).</p>
          <p>Tap the counter name at the top to rename it. Open the gear menu to change the step size, view history, or download a TSV of all events.</p>
        </section>

        <section className="help-section">
          <h2>Multiple counters</h2>
          <p>Open the counter list with the menu icon in the top left. From there you can add, rename, reorder, recolor, or delete counters.</p>
          <p>Swipe left or right on the counter screen to switch between counters.</p>
        </section>

        <section className="help-section">
          <h2>Multi Counter</h2>
          <p>The multi counter view shows up to four counters on one screen. Tap any cell to count, or use the small controls beneath each cell for undo and decrement.</p>
          <p>Open it from the counter list.</p>
        </section>

        <section className="help-section">
          <h2>History</h2>
          <p>Open history from the gear menu to see a timeline of taps and notes grouped by day. Swipe a row left to reveal a delete button for removing individual entries.</p>
        </section>

        <section className="help-section">
          <h2>Notes</h2>
          <p>Attach a timestamped text note to any counter. Notes appear in history alongside tap events and are included in data exports.</p>
          <p>If you enable Web Speech in settings, the note modal will start listening for dictation automatically.</p>
        </section>

        <section className="help-section">
          <h2>Data</h2>
          <p>All data is stored locally on your device. You can export a counter's history or all history at once as a TSV file from the settings menus.</p>
        </section>

        <section className="help-section">
          <h2>Install as app</h2>
          <p>Add this page to your home screen to use it as a full-screen app with no browser chrome. On iOS, tap the Share button in Safari and choose <strong>Add to Home Screen</strong>. On Android, tap the browser menu and choose <strong>Add to Home Screen</strong> or <strong>Install app</strong>.</p>
          <p>Installing as a PWA keeps the screen from sleeping more reliably, removes the address bar, and makes the app launch instantly from your home screen.</p>
        </section>
      </div>
    </div>
  )
}
