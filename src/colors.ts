import type { Counter } from './db'

export const BUTTON_HUES = [245, 175, 25, 310, 140, 50, 200, 5]

export function counterHue(counter: Counter | null | undefined): number {
  if (!counter) return BUTTON_HUES[0]
  if (counter.customHue != null) return counter.customHue
  return BUTTON_HUES[(counter.colorIndex ?? 0) % BUTTON_HUES.length]
}

export function hueToHex(hue: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `hsl(${hue}, 75%, 58%)`
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

export function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return Math.round(h * 60 + 360) % 360
}
