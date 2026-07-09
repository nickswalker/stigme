import type { Counter } from './db'

export const BUTTON_HUES = [245, 175, 25, 310, 140, 50, 200, 5]

export function counterHue(counter: Counter | null | undefined): number {
  if (!counter) return BUTTON_HUES[0]
  if (counter.customHue != null) return counter.customHue
  return BUTTON_HUES[(counter.colorIndex ?? 0) % BUTTON_HUES.length]
}

// Pure-math HSL→hex for hsl(hue, 75%, 58%) — matches the CSS/canvas conversion
// used elsewhere for counter colors, without allocating a canvas per call.
export function hueToHex(hue: number): string {
  const s = 0.75
  const l = 0.58
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((hue % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return '#' + toHex(r) + toHex(g) + toHex(b)
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
