/** Looping ambient soundscape; ducks while narration plays. Starts on first user gesture. */
let el: HTMLAudioElement | null = null
let enabled = true
let ducked = false

function apply() {
  if (!el) return
  el.volume = ducked ? 0.08 : 0.28
  if (enabled) void el.play().catch(() => undefined)
  else el.pause()
}

export function startAmbient() {
  if (!el) { el = new Audio('/audio/ambient.mp3'); el.loop = true }
  apply()
}
export function setAmbientEnabled(on: boolean) { enabled = on; if (on) startAmbient(); else apply() }
export function isAmbientEnabled() { return enabled }
export function duckAmbient(d: boolean) { ducked = d; apply() }
