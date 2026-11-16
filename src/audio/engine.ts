/**
 * Web Audio engine. Layers, each with its own volume:
 *   music     — score tracks (streamed, crossfaded)
 *   ambience  — the general soundscape loop
 *   places    — proximity beds for each monument
 *   voices    — ancient prayers/lines (with stone-hall reverb)
 *   ui        — clicks, whooshes, drums
 * plus a master gain. Narration (HTMLAudio) is separate and ducks the layers.
 */
import { VOICES, type VoiceLine } from '../content/soundscapes'

export type Layer = 'music' | 'ambience' | 'places' | 'voices' | 'ui'
export const LAYERS: Layer[] = ['music', 'ambience', 'places', 'voices', 'ui']

export const settings: { master: number } & Record<Layer, number> = {
  master: 0.7, music: 0.4, ambience: 0.22, places: 0.5, voices: 0.85, ui: 0.5,
}

let ctx: AudioContext | null = null
let master: GainNode, reverb: ConvolverNode
const bus = {} as Record<Layer, GainNode>
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const playing = new Map<string, { src: AudioBufferSourceNode | null; gain: GainNode; level: number; lastOn: number; loading: boolean }>()
let ducked = false
const DUCK: Record<Layer, number> = { music: 0.3, ambience: 0.3, places: 0.22, voices: 0.12, ui: 1 }

function impulse(c: AudioContext, seconds = 2.4, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds), b = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return b
}

export function audioContext() { return ctx }

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return ctx }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain(); master.connect(ctx.destination)
  for (const l of LAYERS) { bus[l] = ctx.createGain(); bus[l].connect(master) }
  reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx)
  const wet = ctx.createGain(); wet.gain.value = 0.45
  reverb.connect(wet).connect(bus.voices)
  applySettings()
  return ctx
}

/** a node in the given layer (used by the HTMLAudio ambience) */
export function layerInput(l: Layer) { return ctx ? bus[l] : null }

export function applySettings() {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(settings.master * 1.4, t, 0.12)
  for (const l of LAYERS) bus[l].gain.setTargetAtTime(settings[l] * (ducked ? DUCK[l] : 1), t, l === 'ui' ? 0.05 : 0.35)
}

export function duckLayers(d: boolean) { ducked = d; applySettings() }

function load(url: string) {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((a) => ctx!.decodeAudioData(a)).catch(() => null)
    buffers.set(url, p)
  }
  return p
}

// ---- place beds -----------------------------------------------------------------------------
/** Set target levels (0..1) for beds by id; beds not listed fade out and are released after a while. */
export function setBedLevels(levels: Record<string, number>) {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const [id, lv] of Object.entries(levels)) {
    if (lv < 0.002) continue
    let p = playing.get(id)
    if (!p) {
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(bus.places)
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

// ---- music ----------------------------------------------------------------------------------
let currentTrack: string | null = null
const tracks = new Map<string, { el: HTMLAudioElement; gain: GainNode }>()
/** Crossfade to a score track (null = silence). Tracks stream from public/audio/music. */
export function setMusic(id: string | null, fade = 3) {
  if (!ctx || id === currentTrack) return
  const t = ctx.currentTime
  if (currentTrack) {
    const old = tracks.get(currentTrack)
    if (old) {
      old.gain.gain.setTargetAtTime(0, t, fade / 3)
      const el = old.el
      window.setTimeout(() => { if (currentTrack !== el.dataset.id) el.pause() }, fade * 1000 + 500)
    }
  }
  currentTrack = id
  if (!id) return
  let tr = tracks.get(id)
  if (!tr) {
    const el = new Audio(`/audio/music/${id}.mp3`); el.loop = true; el.preload = 'auto'; el.dataset.id = id
    const src = ctx.createMediaElementSource(el)
    const gain = ctx.createGain(); gain.gain.value = 0
    src.connect(gain).connect(bus.music)
    tr = { el, gain }; tracks.set(id, tr)
  }
  void tr.el.play().catch(() => undefined)
  tr.gain.gain.setTargetAtTime(1, t, fade / 3)
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
  if (!v || !ensureAudio() || settings.voices <= 0) return
  stopVoice()
  const buf = await load(`/audio/voices/${id}.mp3`)
  if (!buf || !ctx) return
  const src = ctx.createBufferSource(); src.buffer = buf
  const dry = ctx.createGain(); dry.gain.value = 0.8
  src.connect(dry).connect(bus.voices); src.connect(reverb)
  src.onended = () => { if (voiceSrc === src) { voiceSrc = null; voiceListeners.forEach((f) => f(null)) } }
  src.start(); voiceSrc = src
  voiceListeners.forEach((f) => f(v))
}

// ---- interface sounds ----------------------------------------------------------------------
export type UiSound = 'ui-click' | 'whoosh' | 'drum' | 'shimmer' | 'open' | 'hover'

/** a one-shot on any layer (footsteps, landings, barks) with optional stereo pan */
export function playOneShot(id: string, layer: Layer, gain = 1, pan = 0, rate = 1) {
  if (!ctx || ctx.state !== 'running' || settings[layer] <= 0) return
  void load(`/audio/sfx/${id}.mp3`).then((buf) => {
    if (!buf || !ctx) return
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate
    const g = ctx.createGain(); g.gain.value = gain
    const p = ctx.createStereoPanner(); p.pan.value = pan
    src.connect(g).connect(p).connect(bus[layer]); src.start()
  })
}

/** an occasional one-shot on the ambience layer (wind gust, distant birds) */
export function playAmbientOneShot(id: 'gust' | 'birds', gain = 1) {
  if (!ctx || ctx.state !== 'running' || settings.ambience <= 0) return
  void load(`/audio/sfx/${id}.mp3`).then((buf) => {
    if (!buf || !ctx) return
    const src = ctx.createBufferSource(); src.buffer = buf
    src.playbackRate.value = 0.9 + Math.random() * 0.2
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8
    const g = ctx.createGain(); g.gain.value = gain
    src.connect(g).connect(pan).connect(bus.ambience); src.start()
  })
}
const lastPlayed: Partial<Record<UiSound, number>> = {}
const MIN_GAP: Partial<Record<UiSound, number>> = { 'ui-click': 0.06, hover: 0.08, drum: 0.8, shimmer: 0.6, open: 0.3 }
export function playUi(id: UiSound, gain = 1) {
  if (!ctx || ctx.state !== 'running' || settings.ui <= 0) return
  const now = ctx.currentTime
  if (now - (lastPlayed[id] ?? -9) < (MIN_GAP[id] ?? 0)) return
  lastPlayed[id] = now
  void load(`/audio/sfx/${id}.mp3`).then((buf) => {
    if (!buf || !ctx) return
    const src = ctx.createBufferSource(); src.buffer = buf
    if (id === 'ui-click' || id === 'hover') src.playbackRate.value = 0.94 + Math.random() * 0.12
    const g = ctx.createGain(); g.gain.value = gain
    src.connect(g).connect(bus.ui); src.start()
  })
}

if (import.meta.env.DEV) (window as unknown as { __audio: unknown }).__audio = {
  get state() { return { ctx: ctx?.state, track: currentTrack, beds: [...playing.keys()], settings: { ...settings } } },
}
