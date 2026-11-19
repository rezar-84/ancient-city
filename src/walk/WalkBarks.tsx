import { useEffect, useState } from 'react'
import { useApp, walkInputBlocked } from '../store'
import { BARKS } from '../content/barks'
import { CHARACTERS } from '../content/characters'
import { langForYear } from '../content/soundscapes'
import { playBark } from '../audio/engine'
import { playCharacterClip, speakCharacterLine, stopCharacterVoice } from '../audio/characterVoice'
import { NPC_STATE } from './Crowd'
import { walk } from './WalkControls'

interface SubtitleLine {
  speaker?: string
  text: string
  gloss?: string
  accent?: boolean
}

/** Townspeople greet you as you pass, and your chosen character can speak greetings or landmark reflections. */
export function WalkBarks() {
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const [line, setLine] = useState<SubtitleLine | null>(null)

  useEffect(() => {
    if (mode !== 'walk') {
      stopCharacterVoice()
      return
    }
    let last = -10000, lastIdx = -1, hide = 0
    const showLine = (next: SubtitleLine, durationMs = 3600) => {
      setLine(next)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setLine(null), durationMs)
    }

    const speak = (manual = false) => {
      const now = performance.now()
      const s = useApp.getState()
      if (walkInputBlocked(s) || now - last < (manual ? 2200 : 7000)) return
      if (manual) walk.waveUntil = now + 2200
      let best = -1, bd = manual ? 5.5 : 3.5
      for (let i = 0; i < NPC_STATE.count; i++) {
        const d = Math.hypot(NPC_STATE.x[i] - walk.x, NPC_STATE.z[i] - walk.z)
        if (d < bd && (manual || i !== lastIdx)) { bd = d; best = i }
      }
      if (best < 0) {
        // Manual greet with no citizen right beside you: speak your own character's period greeting
        if (manual) {
          const ch = CHARACTERS.find((c) => c.id === s.character) ?? CHARACTERS[2]
          last = now
          speakCharacterLine(ch.greeting.gloss[s.lang], s.lang, { gender: ch.gender, ...ch.voice })
          showLine({ speaker: ch.name, text: ch.greeting.text, gloss: ch.greeting.gloss[s.lang], accent: true }, 4200)
        }
        return
      }
      const female = NPC_STATE.female[best] === 1
      // Townspeople speak the city's Greek; under Rome only soldiers on guard bark in Latin
      const era = langForYear(s.year)
      const lang3 = era === 'koi' && NPC_STATE.guard?.[best] === 1 ? 'la' : era
      const pool = BARKS.filter((b) => b.lang === lang3 && (b.gender === 'any' || b.gender === (female ? 'f' : 'm')))
      if (!pool.length) return
      const b = pool[Math.floor(Math.random() * pool.length)]
      const dx = NPC_STATE.x[best] - walk.x, dz = NPC_STATE.z[best] - walk.z
      const rightX = Math.cos(walk.yaw), rightZ = -Math.sin(walk.yaw)
      const pan = (dx * rightX + dz * rightZ) / Math.max(0.5, Math.hypot(dx, dz))
      playBark(`/audio/barks/${b.id}${b.gender === 'any' && female ? '-f' : ''}.mp3`, pan, 0.9 - bd * 0.12)
      last = now; lastIdx = best
      showLine({ text: b.text, gloss: b.gloss[s.lang] }, 3400)
    }

    const reflect = (ev: Event) => {
      const s = useApp.getState()
      if (walkInputBlocked(s)) return
      const landmarkId = (ev as CustomEvent<string>).detail
      const ch = CHARACTERS.find((c) => c.id === s.character) ?? CHARACTERS[2]
      const thought = ch.reflections[landmarkId]
      if (!thought) return
      const spoken = thought[s.lang]
      playCharacterClip(ch.id, landmarkId, s.lang, spoken, { gender: ch.gender, ...ch.voice })
      showLine({ speaker: ch.name, text: spoken, accent: true }, 6500)
    }

    const greet = () => speak(true)
    const id = window.setInterval(() => speak(), 300)
    window.addEventListener('walk:greet', greet)
    window.addEventListener('walk:reflect', reflect)
    return () => {
      window.clearInterval(id); window.clearTimeout(hide)
      window.removeEventListener('walk:greet', greet)
      window.removeEventListener('walk:reflect', reflect)
      stopCharacterVoice()
      setLine(null)
    }
  }, [mode, lang])

  if (mode !== 'walk' || !line) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-40 z-20 flex justify-center px-4 sm:bottom-36">
      <p className={'max-w-xl rounded-xl px-4 py-2.5 text-center text-sm text-white backdrop-blur-sm ' + (line.accent ? 'border border-gold/40 bg-ink/80' : 'bg-black/55')}>
        {line.speaker && <span className="mr-2 font-display text-xs uppercase tracking-wider text-gold">{line.speaker}:</span>}
        <span className={line.gloss ? 'italic text-travertine/85' : 'text-travertine'}>{line.text}</span>
        {line.gloss && <><span className="mx-2 text-white/40">—</span>{line.gloss}</>}
      </p>
    </div>
  )
}
