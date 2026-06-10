let audioCtx: AudioContext | null = null

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  return source
}

export function playSwipe() {
  const ctx = getCtx()
  const now = ctx.currentTime

  // Whoosh: filtered noise with frequency sweep
  const noise = createNoise(ctx, 0.1)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.setValueAtTime(2, now)
  const baseHz = 1500 + Math.random() * 600
  filter.frequency.setValueAtTime(baseHz, now)
  filter.frequency.exponentialRampToValueAtTime(baseHz * 0.5, now + 0.1)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.1, now + 0.06)
  gain.gain.linearRampToValueAtTime(0, now + 0.075)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + 0.1)
}

export function playFlip() {
  const ctx = getCtx()
  const now = ctx.currentTime

  // Card flip: quick burst of noise rising in pitch
  const noise = createNoise(ctx, 0.12)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.setValueAtTime(2, now)
  filter.frequency.setValueAtTime(1200, now)
  filter.frequency.exponentialRampToValueAtTime(2000, now + 0.06)
  filter.frequency.exponentialRampToValueAtTime(1000, now + 0.12)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.1, now + 0.01)
  gain.gain.setValueAtTime(0.08, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + 0.12)
}

const rarityCelebrationConfig: Record<string, { notes: number[]; duration: number; volume: number }> = {
  common: { notes: [], duration: 0, volume: 0 },
  uncommon: { notes: [523, 659], duration: 0.2, volume: 0.07 },
  rare: { notes: [523, 659, 784], duration: 0.25, volume: 0.09 },
  ultra_rare: { notes: [523, 659, 784, 1047], duration: 0.3, volume: 0.11 },
  legendary: { notes: [523, 659, 784, 1047, 1319], duration: 0.35, volume: 0.13 },
  secret_rare: { notes: [523, 659, 784, 1047, 1319, 1568], duration: 0.4, volume: 0.15 },
}

export function playCelebration(rarity: string) {
  const ctx = getCtx()
  const now = ctx.currentTime
  const config = rarityCelebrationConfig[rarity] || rarityCelebrationConfig.common

  config.notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    const startTime = now + i * 0.1
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(config.volume, startTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + config.duration)

    osc.start(startTime)
    osc.stop(startTime + config.duration)
  })

  // Shimmer for ultra rare and above
  if (['ultra_rare', 'legendary', 'secret_rare'].includes(rarity)) {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      const startTime = now + 0.2 + i * 0.08
      const freq = 2000 + Math.random() * 2000
      osc.frequency.setValueAtTime(freq, startTime)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + 0.15)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.04, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2)

      osc.start(startTime)
      osc.stop(startTime + 0.2)
    }
  }
}
