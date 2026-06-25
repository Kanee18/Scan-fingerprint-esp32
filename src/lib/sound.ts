// Bunyi feedback sederhana memakai Web Audio API (tanpa file aset).
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

function tone(freq: number, durationMs: number, delayMs = 0, type: OscillatorType = 'sine') {
  const ac = getCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(ac.destination)
  const start = ac.currentTime + delayMs / 1000
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000)
  osc.start(start)
  osc.stop(start + durationMs / 1000)
}

export const beep = {
  success: () => {
    tone(880, 120)
    tone(1320, 160, 110)
  },
  warning: () => {
    tone(520, 200)
  },
  error: () => {
    tone(300, 180)
    tone(220, 220, 160)
  },
}
