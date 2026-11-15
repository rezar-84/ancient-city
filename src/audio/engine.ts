/**
 * Web Audio engine for place soundscapes: looping beds mixed by proximity, one-shot voices with a
 * stone-hall reverb, and small interface sounds. Created on the first user gesture.
 */
import { VOICES, type VoiceLine } from '../content/soundscapes'

let ctx: AudioContext | null = null
let master: GainNode, beds: GainNode, voiceBus: GainNode, ui: GainNode, reverb: ConvolverNode
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const playing = new Map<string, { src: AudioBufferSourceNode | null; gain: GainNode; level: number; lastOn: number; loading: boolean }>()

export const settings = { places: true, ui: true, volume: 0.5 }
let ducked = false

function impulse(c: AudioContext, seconds = 2.4, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds), b = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return b
}

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return ctx }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain(); master.connect(ctx.destination)
  beds = ctx.createGain(); beds.connect(master)
  voiceBus = ctx.createGain(); voiceBus.connect(master)
  ui = ctx.createGain(); ui.connect(master)
  reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx)
  const wet = ctx.createGain(); wet.gain.value = 0.45
  reverb.connect(wet).connect(voiceBus)
  applySettings()
  return ctx
}

export function applySettings() {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(settings.volume * 1.6, t, 0.15)
  beds.gain.setTargetAtTime(settings.places ? (ducked ? 0.22 : 1) : 0, t, 0.4)
  voiceBus.gain.setTargetAtTime(settings.places ? (ducked ? 0.15 : 1) : 0, t, 0.3)
  ui.gain.setTargetAtTime(settings.ui ? 1 : 0, t, 0.05)
}

export function duckPlaces(d: boolean) { ducked = d; applySettings() }

function load(url: string) {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((a) => ctx!.decodeAudioData(a)).catch(() => null)
    buffers.set(url, p)
  }
  return p
}

/** Set target levels (0..1) for beds by id; beds not listed fade out and are released after a while. */
export function setBedLevels(levels: Record<string, number>) {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const [id, lv] of Object.entries(levels)) {
    if (lv < 0.002) continue
    let p = playing.get(id)
    if (!p) {
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(beds)
      p = { src: null, gain, level: 0, lastOn: now, loading: true }
      playing.set(id, p)
      const entry = p
      void load(`/audio/sfx/${id}.mp3`).then((buf) => {
        entry.loading = false
        if (!buf || !ctx || playing.get(id) !== entry) return
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
        src.connect(entry.gain); src.start(0, Math.random() * buf.duration)
        entry.src = src
      })
    }
    p.lastOn = now
  }
  for (const [id, p] of playing) {
    const lv = levels[id] ?? 0
    if (Math.abs(lv - p.level) > 0.005) { p.gain.gain.setTargetAtTime(lv, now, 0.6); p.level = lv }
    if (lv < 0.002 && now - p.lastOn > 6 && !p.loading) {
      p.src?.stop(); p.src?.disconnect(); p.gain.disconnect(); playing.delete(id)
    }
  }
}

// ---- voices -------------------------------------------------------------------------------
let voiceSrc: AudioBufferSourceNode | null = null
const voiceListeners = new Set<(v: VoiceLine | null) => void>()
export function onVoice(fn: (v: VoiceLine | null) => void) { voiceListeners.add(fn); return () => { voiceListeners.delete(fn) } }

export function stopVoice() {
  if (voiceSrc) { try { voiceSrc.stop() } catch { /* already stopped */ } voiceSrc = null }
  voiceListeners.forEach((f) => f(null))
}

export async function playVoice(id: string) {
  const v = VOICES.find((x) => x.id === id)
  if (!v || !ensureAudio() || !settings.places) return
  stopVoice()
  const buf = await load(`/audio/voices/${id}.mp3`)
  if (!buf || !ctx) return
  const src = ctx.createBufferSource(); src.buffer = buf
  const dry = ctx.createGain(); dry.gain.value = 0.8
  src.connect(dry).connect(voiceBus); src.connect(reverb)
  src.onended = () => { if (voiceSrc === src) { voiceSrc = null; voiceListeners.forEach((f) => f(null)) } }
  src.start(); voiceSrc = src
  voiceListeners.forEach((f) => f(v))
}

// ---- interface sounds ----------------------------------------------------------------------
let lastUi = 0
export function playUi(id: 'ui-click' | 'whoosh', gain = 1) {
  if (!ctx || ctx.state !== 'running' || !settings.ui) return
  const now = ctx.currentTime
  if (id === 'ui-click' && now - lastUi < 0.06) return
  lastUi = now
  void load(`/audio/sfx/${id}.mp3`).then((buf) => {
    if (!buf || !ctx) return
    const src = ctx.createBufferSource(); src.buffer = buf
    src.playbackRate.value = 0.94 + Math.random() * 0.12
    const g = ctx.createGain(); g.gain.value = gain
    src.connect(g).connect(ui); src.start()
  })
}
