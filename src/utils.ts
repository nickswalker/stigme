import type { TapRecord, NoteRecord } from './db'

export function formatElapsed(ms: number): string {
  const totalS = ms / 1000
  const ss = Math.floor(totalS)
  const mm = Math.floor(ss / 60)
  const hh = Math.floor(mm / 60)
  const dd = Math.floor(hh / 24)
  if (mm === 0) return `${ss}.${Math.floor((ms % 1000) / 100)}`
  if (hh === 0) return `${mm}:${String(ss % 60).padStart(2, '0')}`
  if (dd === 0) return `${hh}:${String(mm % 60).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}`
  return `${dd}:${String(hh % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}`
}

export function downloadAsTSV(rows: string[], filename: string): void {
  const blob = new Blob([rows.join('\n')], { type: 'text/tab-separated-values' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const HISTORY_HEADER = ['Counter', 'Action', 'Value', 'Note', 'Timestamp'].join('\t')

function sanitizeCell(text: string): string {
  return text.replace(/\t|\n/g, ' ')
}

// Assemble the shared TSV lines for a set of taps + notes. `nameFor` resolves a
// counterId to its current display name (callers decide the fallback).
export function buildHistoryRows(
  taps: TapRecord[],
  notes: NoteRecord[],
  nameFor: (counterId: string) => string,
): string[] {
  const rows = [
    ...taps.map(r => ({
      ts: r.timestamp,
      cols: [nameFor(r.counterId), r.value >= 0 ? 'increment' : 'decrement', String(r.value), ''],
    })),
    ...notes.map(n => ({
      ts: n.timestamp,
      cols: [nameFor(n.counterId), 'note', '', sanitizeCell(n.text)],
    })),
  ]
  return [
    HISTORY_HEADER,
    ...rows
      .sort((a, b) => a.ts - b.ts)
      .map(r => [...r.cols, new Date(r.ts).toISOString()].join('\t')),
  ]
}

export function exportHistoryTSV(
  taps: TapRecord[],
  notes: NoteRecord[],
  nameFor: (counterId: string) => string,
  filename: string,
): void {
  downloadAsTSV(buildHistoryRows(taps, notes, nameFor), filename)
}
