import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { CHARACTERS, ERA_LABEL, type Character } from '../content/characters'
import { startAmbient } from '../ui/ambient'
import { playCharacterClip, stopCharacterVoice, voiceSupported } from '../audio/characterVoice'

const ERA_ART: Record<Character['era'], string> = {
  hellenistic: '/art/sanctuary-hellenistic.jpg',
  roman: '/art/plateia-roman.jpg',
  byzantine: '/art/pilgrims-byzantine.jpg',
}
const tr = (lang: 'en' | 'tr', en: string, t: string) => (lang === 'en' ? en : t)

export function beginWalk(c: Character) {
  startAmbient()
  const s = useApp.getState()
  s.select(null)
  s.setWalkSession(false)
  s.setWalkPaused(false)
  s.setCharacter(c.id)
  s.setYear(c.year)
  s.setEra('ancient')
  s.setShowGrid(true)
  s.setMode('walk')
}

/** Resume the in-memory session without replacing its position or view. */
export function resumeWalk() {
  const st = useApp.getState()
  const c = CHARACTERS.find(c => c.id === st.character)
  if (!st.walkSession || !c) return
  st.setYear(c.year); st.setEra('ancient'); st.setShowGrid(true)
  st.select(null); st.setWalkPaused(false); st.setMode('walk'); startAmbient()
}

/** "Walk the city": choose a woman or man from one of three periods. */
export function CharacterSelect() {
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const session = useApp((s) => s.walkSession)
  const [pick, setPick] = useState<Character>(CHARACTERS[2])
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    stopCharacterVoice()
    setSpeaking(false)
    return () => stopCharacterVoice()
  }, [pick.id, mode])
  if (mode !== 'choose') return null
  const eras = ['hellenistic', 'roman', 'byzantine'] as const
  const toggleVoice = () => {
    if (speaking) { stopCharacterVoice(); setSpeaking(false); return }
    const text = `${pick.greeting.gloss[lang]} ${pick.backstory[lang]}`
    const ok = playCharacterClip(pick.id, 'intro', lang, text, { gender: pick.gender, ...pick.voice }, () => setSpeaking(false))
    if (ok) setSpeaking(true)
  }

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-ink text-travertine">
      <div className="pointer-events-none fixed inset-0 bg-cover bg-center opacity-35 transition-[background-image] duration-700" style={{ backgroundImage: `url(${ERA_ART[pick.era]})` }} />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
        <div className="flex items-center justify-between gap-3">
          <button className="glass btn-ghost" onClick={() => useApp.getState().setMode('explore')}>← {tr(lang, 'Back', 'Geri')}</button>
          <p className="text-[10px] uppercase tracking-[0.3em] text-travertine/50">{tr(lang, 'AI-generated illustrations', 'Yapay zekâ ile üretilmiş resimler')}</p>
        </div>
        <h1 className="mt-5 font-display text-3xl tracking-[0.08em] text-gold sm:text-5xl">{tr(lang, 'Walk the city', 'Kentte yürü')}</h1>
        <p className="mt-2 max-w-2xl font-serif text-lg italic text-travertine/85">{tr(lang,
          'Choose who you are. Your period decides which buildings stand, which language you hear, and which music plays.',
          'Kim olduğunu seç. Dönemin hangi yapıların ayakta olduğunu, hangi dili duyacağını ve hangi müziğin çalacağını belirler.')}</p>

        {session && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 p-4">
          <p className="flex-1 text-sm">{tr(lang, 'Your walk is saved for this visit. Resume where you left off, or choose a character to start again.', 'Yürüyüşünüz bu ziyaret için saklanır. Kaldığınız yerden devam edin veya yeniden başlamak için bir karakter seçin.')}</p>
          <button className="btn-gold" onClick={resumeWalk}>{tr(lang, 'Resume walk', 'Yürüyüşe devam et')}</button>
        </div>}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {eras.map((era) => (
            <section key={era}>
              <h2 className="mb-2 flex items-baseline justify-between border-b border-gold/30 pb-1">
                <span className="font-display text-lg tracking-[0.15em]">{ERA_LABEL[era][lang].toUpperCase()}</span>
                <span className="text-xs text-travertine/60">{ERA_LABEL[era].years[lang]}</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {CHARACTERS.filter((c) => c.era === era).map((c) => {
                  const on = pick.id === c.id
                  return (
                    <button key={c.id} onClick={() => setPick(c)} onDoubleClick={() => beginWalk(c)}
                      className={'group overflow-hidden rounded-2xl text-left transition ' + (on ? 'ring-2 ring-gold shadow-[0_0_40px_rgba(201,164,92,.35)]' : 'ring-1 ring-white/10 hover:ring-white/30')}
                      aria-pressed={on}>
                      <img src={c.portrait} alt="" className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      <div className="bg-black/50 px-3 py-2">
                        <p className="font-display text-sm leading-tight">{c.name}</p>
                        <p className="text-[11px] text-travertine/70">{c.role[lang]}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* chosen character */}
      <div className="glass fixed inset-x-2.5 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-4xl items-center gap-3 rounded-3xl p-2.5 sm:gap-4 sm:p-3">
        <img src={pick.portrait} alt="" className="h-14 w-11 shrink-0 rounded-xl object-cover sm:h-16 sm:w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base">{pick.name} <span className="text-xs text-travertine/60">· {pick.role[lang]} · {ERA_LABEL[pick.era][lang]}</span></p>
          <p className="line-clamp-2 text-xs text-travertine/80">{pick.backstory[lang]}</p>
          <p className="mt-0.5 hidden truncate text-[11px] italic text-gold/85 sm:block">{tr(lang, 'Objective:', 'Hedef:')} {pick.goal[lang]}</p>
        </div>
        {voiceSupported() && (
          <button type="button" className="btn-ghost shrink-0 px-3 py-2 text-xs" onClick={toggleVoice}>
            {speaking ? tr(lang, '■ Stop', '■ Durdur') : tr(lang, '🔊 Voice', '🔊 Ses')}
          </button>
        )}
        <button className="btn-gold shrink-0 px-5 py-2.5" onClick={() => { stopCharacterVoice(); beginWalk(pick) }}>{tr(lang, session ? 'Start new walk' : 'Begin', session ? 'Yeni yürüyüş' : 'Başla')} →</button>
      </div>
    </div>
  )
}
