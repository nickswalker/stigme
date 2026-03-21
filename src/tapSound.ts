let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  // iOS suspends AudioContext until user gesture; resume if needed
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Major scale semitone offsets — 8 distinct pitches, one per hue, within one octave.
// Range: 880–1760 Hz (A5–A6).
const SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12]

function indexToFreq(colorIndex: number): number {
  const semitones = SCALE_SEMITONES[colorIndex % SCALE_SEMITONES.length]
  return 880 * Math.pow(2, semitones / 12)
}

export function playTap(colorIndex: number, direction: 1 | -1 = 1): void {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime
    const freq = indexToFreq(colorIndex) * (direction === 1 ? 1 : 0.794)  // minor third down for decrement

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
