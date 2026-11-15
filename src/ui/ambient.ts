/** Looping ambient soundscape; ducks while narration plays. Starts on first user gesture.
 *  On/off and volume are remembered per browser. */
const KEY = 'hierapolis.ambient'

let el: HTMLAudioElement | null = null
let enabled = true
let volume = 0.5 // 0..1 user setting; file is mastered quiet (~-28 LUFS)
let ducked = false
let started = false
const listeners = new Set<() => void>()

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { enabled?: boolean; volume?: number } | null
  if (saved) {
    if (typeof saved.enabled === 'boolean') enabled = saved.enabled
    if (typeof saved.volume === 'number') volume = Math.min(1, Math.max(0, saved.volume))
  }
} catch { /* storage unavailable */ }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ enabled, volume })) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

function apply() {
  if (!el) return
  el.volume = volume * (ducked ? 0.25 : 1)
  if (enabled && started && volume > 0) void el.play().catch(() => undefined)
  else el.pause()
}

export function startAmbient() {
  started = true
  if (!el) { el = new Audio('/audio/ambient.mp3'); el.loop = true }
  apply()
}
export function setAmbientEnabled(on: boolean) { enabled = on; if (on && started) startAmbient(); else apply(); persist() }
export function setAmbientVolume(v: number) { volume = Math.min(1, Math.max(0, v)); if (enabled && started) startAmbient(); else apply(); persist() }
export function isAmbientEnabled() { return enabled }
export function getAmbientVolume() { return volume }
export function duckAmbient(d: boolean) { ducked = d; apply() }
export function onAmbientChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
