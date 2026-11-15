/** Sound settings hub: the looping ambient soundscape (HTMLAudio) plus the Web Audio place engine.
 *  On/off switches and volume are remembered per browser. Starts on the first user gesture. */
import { applySettings, duckPlaces, ensureAudio, settings, stopVoice } from '../audio/engine'

const KEY = 'hierapolis.ambient'

let el: HTMLAudioElement | null = null
let enabled = true
let ducked = false
let started = false
const listeners = new Set<() => void>()

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { enabled?: boolean; volume?: number; places?: boolean; ui?: boolean } | null
  if (saved) {
    if (typeof saved.enabled === 'boolean') enabled = saved.enabled
    if (typeof saved.volume === 'number') settings.volume = Math.min(1, Math.max(0, saved.volume))
    if (typeof saved.places === 'boolean') settings.places = saved.places
    if (typeof saved.ui === 'boolean') settings.ui = saved.ui
  }
} catch { /* storage unavailable */ }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ enabled, volume: settings.volume, places: settings.places, ui: settings.ui })) } catch { /* ignore */ }
  applySettings()
  listeners.forEach((l) => l())
}

function apply() {
  if (!el) return
  el.volume = Math.min(1, settings.volume * 0.7 * (ducked ? 0.25 : 1))
  if (enabled && started && settings.volume > 0) void el.play().catch(() => undefined)
  else el.pause()
}

export function startAmbient() {
  started = true
  ensureAudio()
  if (!el) { el = new Audio('/audio/ambient.mp3'); el.loop = true }
  apply()
}
export function setAmbientEnabled(on: boolean) { enabled = on; if (on && started) startAmbient(); else apply(); persist() }
export function setAmbientVolume(v: number) { settings.volume = Math.min(1, Math.max(0, v)); if (started) startAmbient(); else apply(); persist() }
export function setPlaceSounds(on: boolean) { settings.places = on; if (!on) stopVoice(); persist() }
export function setUiSounds(on: boolean) { settings.ui = on; persist() }
export function isAmbientEnabled() { return enabled }
export function getAmbientVolume() { return settings.volume }
export function getPlaceSounds() { return settings.places }
export function getUiSounds() { return settings.ui }
/** Narration playing: duck ambience, place beds and voices. */
export function duckAmbient(d: boolean) { ducked = d; apply(); duckPlaces(d); if (d) stopVoice() }
export function onAmbientChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
