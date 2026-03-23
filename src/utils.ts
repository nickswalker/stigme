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
