let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  // iOS suspends AudioContext until user gesture; resume if needed
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Each counter index gets a distinct whole-tone pitch (2 semitones per step),
// cycling through an octave. Range: 880–1760 Hz (A5–A6).
function indexToFreq(colorIndex: number): number {
  return 880 * Math.pow(2, ((colorIndex * 2) % 12) / 12)
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
    // Brief pitch-drop transient gives a "thock" quality
    osc.frequency.setValueAtTime(freq * 1.4, now)
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.012)

    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)

    osc.start(now)
    osc.stop(now + 0.05)
  } catch {
    // Silently ignore — audio is non-critical
  }
}
