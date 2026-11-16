import { useEffect, useState } from 'react'
import { useApp, walkInputBlocked } from '../store'
import { BARKS, type Bark } from '../content/barks'
import { langForYear } from '../content/soundscapes'
import { playBark } from '../audio/engine'
import { NPC_STATE } from './Crowd'
import { walk } from './WalkControls'

/** Townspeople greet you as you pass: a short subtitled line in the language of the period. */
export function WalkBarks() {
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const [line, setLine] = useState<Bark | null>(null)

  useEffect(() => {
    if (mode !== 'walk') return
    let last = -10000, lastIdx = -1, hide = 0
    const speak = (manual = false) => {
      const now = performance.now()
      const s = useApp.getState()
      if (walkInputBlocked(s) || now - last < (manual ? 2500 : 7000)) return
      if (manual) walk.waveUntil = now + 2200
      let best = -1, bd = manual ? 5 : 3.5
      for (let i = 0; i < NPC_STATE.count; i++) {
        const d = Math.hypot(NPC_STATE.x[i] - walk.x, NPC_STATE.z[i] - walk.z)
        if (d < bd && (manual || i !== lastIdx)) { bd = d; best = i }
      }
      if (best < 0) return
      const female = NPC_STATE.female[best] === 1
      const pool = BARKS.filter((b) => b.lang === langForYear(s.year) && (b.gender === 'any' || b.gender === (female ? 'f' : 'm')))
      if (!pool.length) return
      const b = pool[Math.floor(Math.random() * pool.length)]
      // pan from the speaker's bearing relative to where the walker looks
      const dx = NPC_STATE.x[best] - walk.x, dz = NPC_STATE.z[best] - walk.z
      const rightX = Math.cos(walk.yaw), rightZ = -Math.sin(walk.yaw)
      const pan = (dx * rightX + dz * rightZ) / Math.max(0.5, Math.hypot(dx, dz))
      playBark(`/audio/barks/${b.id}${b.gender === 'any' && female ? '-f' : ''}.mp3`, pan, 0.9 - bd * 0.12)
      last = now; lastIdx = best
      setLine(b); window.clearTimeout(hide); hide = window.setTimeout(() => setLine(null), 3200)
    }
    const greet = () => speak(true)
    const id = window.setInterval(() => speak(), 300)
    window.addEventListener('walk:greet', greet)
    return () => { window.clearInterval(id); window.clearTimeout(hide); window.removeEventListener('walk:greet', greet); setLine(null) }
  }, [mode])

  if (mode !== 'walk' || !line) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-40 z-20 flex justify-center px-4 sm:bottom-36">
      <p className="rounded-xl bg-black/55 px-4 py-2 text-center text-sm text-white backdrop-blur-sm">
        <span className="italic text-travertine/80">{line.text}</span>
        <span className="mx-2 text-white/40">—</span>
        {line.gloss[lang]}
      </p>
    </div>
  )
}
