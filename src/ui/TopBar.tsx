import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { useT } from '../i18n'
import { getVolume, onAmbientChange, setVolume } from './ambient'
import type { Layer } from '../audio/engine'
import { TimeOfDayButton, TimeOfDayPanel } from './TimeOfDay'

export function LangSwitch() {
  const lang = useApp((s) => s.lang)
  return (
    <div className="glass flex rounded-full p-1 text-xs">
      {(['en', 'tr'] as const).map((l) => (
        <button key={l} className={lang === l ? 'btn-active px-3 py-1' : 'btn-ghost px-3 py-1'} onClick={() => useApp.getState().setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function ModeTabs({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const set = useApp.getState()
  const tabs: Array<{ id: 'explore' | 'plan' | 'tour' | 'choose'; icon: string; label: string; go: () => void }> = [
    { id: 'explore', icon: '◭', label: t('map3d'), go: () => set.setMode('explore') },
    { id: 'plan', icon: '▦', label: t('plan'), go: () => { set.setEra('ancient'); set.setMode('plan') } },
    { id: 'tour', icon: '▶', label: t('tour'), go: () => { set.select(null); set.setMode('tour'); set.setTour(0, true) } },
    { id: 'choose', icon: '⚑', label: t('walk'), go: () => { set.select(null); set.setMode('choose') } },
  ]
  if (compact) return (
    <>
      {tabs.map((x) => (
        <button key={x.id} onClick={x.go} aria-current={mode === x.id}
          className={'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] leading-tight ' + (mode === x.id ? 'bg-travertine/90 text-ink' : 'text-travertine/80')}>
          <span className="text-base leading-none" aria-hidden>{x.icon}</span>{x.label}
        </button>
      ))}
    </>
  )
  return (
    <>
      {tabs.map((x) => (
        <button key={x.id} className={mode === x.id ? 'btn-active' : 'btn-ghost'} onClick={x.go}>{x.id === 'tour' ? '▶ ' : x.id === 'choose' ? '⚑ ' : ''}{x.label}</button>
      ))}
    </>
  )
}

function EraSwitch() {
  const t = useT()
  const era = useApp((s) => s.era)
  const set = useApp.getState()
  return (
    <div className="glass flex rounded-full p-1 text-xs">
      <button className={era === 'ancient' ? 'btn-active px-3 py-1' : 'btn-ghost px-3 py-1'} onClick={() => set.setEra('ancient')}>{t('ancient')}</button>
      <button className={era === 'today' ? 'btn-active px-3 py-1' : 'btn-ghost px-3 py-1'} onClick={() => set.setEra('today')}>{t('today')}</button>
    </div>
  )
}

function GridToggle() {
  const t = useT()
  const showGrid = useApp((s) => s.showGrid)
  return (
    <button
      className={'glass inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ' + (showGrid ? 'border-gold bg-gold/80 text-ink' : 'border-white/30 text-travertine hover:border-gold')}
      onClick={() => useApp.getState().setShowGrid(!showGrid)} aria-pressed={showGrid} title={t('wholeCityTip')}
    >
      <span>{t('wholeCity')}</span>
      <span aria-hidden="true" className={'relative inline-flex h-5 w-9 shrink-0 rounded-full ' + (showGrid ? 'bg-ink/70' : 'bg-white/25')}>
        <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-travertine ' + (showGrid ? 'right-0.5' : 'left-0.5')} />
      </span>
      <span>{t(showGrid ? 'cityDetailsOn' : 'cityDetailsOff')}</span>
    </button>
  )
}

export function TopBar() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const [qr, setQr] = useState(false)
  const [more, setMore] = useState(false)
  if (mode === 'intro' || mode === 'walk' || mode === 'choose') return null
  const set = useApp.getState()
  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:gap-3 sm:p-4">
        <button className="pointer-events-auto glass flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 sm:gap-3 sm:py-1.5 sm:pl-2 sm:pr-4" onClick={() => { set.select(null); set.setMode('intro') }}>
          <img src="/favicon.svg" alt="" className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="font-display text-sm tracking-[0.15em] sm:text-lg">HIERAPOLIS</span>
        </button>

        <nav className="pointer-events-auto glass mx-auto hidden rounded-full p-1 sm:flex"><ModeTabs /></nav>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <GridToggle />
            {mode !== 'plan' && <EraSwitch />}
            <LangSwitch />
          </div>
          <div className="hidden sm:block"><TimeOfDayButton /></div>
          <SoundMenu />
          <a className="glass btn-ghost hidden sm:inline-flex" href="#/guide" target="_blank" rel="noreferrer" title={t('guide')}>⎙</a>
          <button className="glass btn-ghost hidden sm:inline-flex" onClick={() => setQr((q) => !q)} title={t('scanToOpen')}>▦</button>
          <button className="glass btn-ghost h-9 w-9 justify-center p-0 text-lg sm:hidden" onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="menu">⋯</button>
        </div>

        {qr && (
          <div className="pointer-events-auto absolute right-4 top-20 glass rounded-2xl p-4 text-center" onClick={() => setQr(false)}>
            <div className="rounded-xl bg-white p-3"><QRCodeSVG value={window.location.origin} size={180} /></div>
            <p className="mt-2 text-xs text-travertine/80">{t('scanToOpen')}</p>
            <p className="text-[11px] text-travertine/50">{window.location.host}</p>
          </div>
        )}
      </header>

      <div className="absolute left-2.5 top-[calc(max(0.625rem,env(safe-area-inset-top))+48px)] z-20 sm:hidden">
        <GridToggle />
      </div>

      {/* mobile: options sheet */}
      {more && (
        <div className="absolute inset-0 z-40 sm:hidden" onClick={() => setMore(false)}>
          <div className="glass absolute right-2.5 top-14 w-[min(88vw,320px)] rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-3 text-sm">
              {mode !== 'plan' && <div className="flex items-center justify-between"><span className="text-travertine/70">{lang === 'en' ? 'View' : 'Görünüm'}</span><EraSwitch /></div>}
              <div className="flex items-center justify-between"><span className="text-travertine/70">{lang === 'en' ? 'Language' : 'Dil'}</span><LangSwitch /></div>
              {mode !== 'plan' && <div className="border-t border-white/10 pt-3"><TimeOfDayPanel /></div>}
              <div className="flex gap-2 border-t border-white/10 pt-3">
                <a className="btn-ghost flex-1 justify-center rounded-xl border border-white/15" href="#/guide">⎙ {t('guide')}</a>
                <a className="btn-ghost flex-1 justify-center rounded-xl border border-white/15" href="#/poster">▭ {lang === 'en' ? 'Posters' : 'Posterler'}</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* mobile: bottom tab bar */}
      {mode !== 'tour' && (
        <nav className="glass absolute inset-x-2.5 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-20 flex gap-1 rounded-3xl p-1 sm:hidden"><ModeTabs compact /></nav>
      )}
    </>
  )
}

/** Sound mixer: master plus one volume per layer, remembered per browser. */
const MIX: Array<Layer | 'master'> = ['master', 'music', 'ambience', 'places', 'voices', 'ui']
const MIX_LABEL: Record<Layer | 'master', { en: string; tr: string; icon: string }> = {
  master: { en: 'Master', tr: 'Ana ses', icon: '◉' },
  music: { en: 'Music', tr: 'Müzik', icon: '♪' },
  ambience: { en: 'Ambience', tr: 'Ortam', icon: '≈' },
  places: { en: 'Places', tr: 'Mekânlar', icon: '⌂' },
  voices: { en: 'Ancient voices', tr: 'Antik sesler', icon: '❝' },
  ui: { en: 'Interface', tr: 'Arayüz', icon: '•' },
}

export function SoundMenu() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)
  useEffect(() => onAmbientChange(() => force((n) => n + 1)), [])
  const muted = getVolume('master') === 0
  return (
    <div className="relative">
      <button
        className="glass btn-ghost flex items-center gap-1.5"
        onClick={() => setOpen((o) => !o)}
        title={t('sound')} aria-label={t('sound')} aria-expanded={open}
      >
        <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
        <span className="hidden text-xs sm:inline">{t('sound')}</span>
      </button>
      {open && (
        <div className="glass absolute right-0 top-12 z-40 w-72 rounded-2xl p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display tracking-[0.15em] text-gold">{t('sound').toUpperCase()}</span>
            <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => setVolume('master', muted ? 0.7 : 0)}>{muted ? (lang === 'en' ? 'Unmute' : 'Sesi aç') : (lang === 'en' ? 'Mute all' : 'Tümünü kapat')}</button>
          </div>
          {MIX.map((k) => {
            const v = getVolume(k)
            return (
              <label key={k} className={'mt-2 block ' + (k === 'master' ? 'border-b border-white/10 pb-2' : '')}>
                <span className="mb-0.5 flex justify-between text-xs text-travertine/80">
                  <span><span className="mr-1.5 inline-block w-3 text-center text-gold" aria-hidden>{MIX_LABEL[k].icon}</span>{MIX_LABEL[k][lang]}</span>
                  <span className="tabular-nums text-travertine/50">{Math.round(v * 100)}%</span>
                </span>
                <input
                  type="range" min={0} max={100} step={5} value={Math.round(v * 100)}
                  onChange={(e) => setVolume(k, Number(e.target.value) / 100)}
                  className="w-full accent-amber-500" aria-label={MIX_LABEL[k][lang]}
                />
              </label>
            )
          })}
          <p className="mt-3 text-[11px] leading-snug text-travertine/50">{t('soundNote')}</p>
        </div>
      )}
    </div>
  )
}
