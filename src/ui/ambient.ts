/** Sound settings hub: per-layer volumes (persisted per browser), the general ambience loop, and
 *  narration ducking. Starts on the first user gesture. */
import { LAYERS, applySettings, duckLayers, ensureAudio, layerInput, pageHidden, settings, stopVoice, trackMediaElement, type Layer } from '../audio/engine'

const KEY = 'hierapolis.sound.v3' // v3: quieter defaults, insect-free ambience

let el: HTMLAudioElement | null = null
let breezeGain: GainNode | null = null
let breezeLevel = 1
let started = false
const listeners = new Set<() => void>()

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<typeof settings> | null
  if (saved) for (const k of ['master', ...LAYERS] as const) if (typeof saved[k] === 'number') settings[k] = Math.min(1, Math.max(0, saved[k]!))
} catch { /* storage unavailable */ }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  applySettings()
  listeners.forEach((l) => l())
}

export function startAmbient() {
  started = true
  const c = ensureAudio()
  if (!el) {
    el = new Audio('/audio/sfx/breeze.mp3'); el.loop = true
    trackMediaElement(el)
    const input = layerInput('ambience')
    if (c && input) {
      breezeGain = c.createGain(); breezeGain.gain.value = breezeLevel
      c.createMediaElementSource(el).connect(breezeGain).connect(input)
    }
  }
  if (!pageHidden()) void el.play().catch(() => undefined)
}

/** relative level of the general breeze loop (time of day: quieter at night) */
export function setBreezeLevel(v: number) {
  if (Math.abs(v - breezeLevel) < 0.01) return
  breezeLevel = v
  if (breezeGain) breezeGain.gain.setTargetAtTime(v, breezeGain.context.currentTime, 1.5)
}

export function setVolume(layer: Layer | 'master', v: number) {
  settings[layer] = Math.min(1, Math.max(0, v))
  if (layer === 'voices' && v <= 0) stopVoice()
  if (started) startAmbient()
  persist()
}
export function getVolume(layer: Layer | 'master') { return settings[layer] }
export function muteAll(m: boolean) { setVolume('master', m ? 0 : 0.7) }

/** Narration playing: duck music, ambience, places and voices. */
export function duckAmbient(d: boolean) { duckLayers(d); if (d) stopVoice() }
export function onAmbientChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
