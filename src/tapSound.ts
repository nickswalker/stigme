import { getPreferSound } from './preferences'

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  // iOS suspends AudioContext until user gesture; resume if needed
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Major scale semitone offsets — 8 distinct pitches within one octave.
// Range: 880–1760 Hz (A5–A6).
const SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12]

// Map a hue (0–360) to one of the 8 scale tones by bucketing into 45° segments.
function hueToSemitones(hue: number): number {
  return SCALE_SEMITONES[Math.round(hue / 45) % 8]
}

export function playTap(hue: number, direction: 1 | -1 = 1): void {
  if (!getPreferSound()) return
  try {
    const ctx = getCtx()
    const now = ctx.currentTime
    const freq = 880 * Math.pow(2, hueToSemitones(hue) / 12) * (direction === 1 ? 1 : 0.794)

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)

    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)

    osc.start(now)
    osc.stop(now + 0.05)
  } catch {
    // Silently ignore — audio is non-critical
  }
}
