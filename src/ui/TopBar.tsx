import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { useT } from '../i18n'
import { getVolume, onAmbientChange, setVolume } from './ambient'
import type { Layer } from '../audio/engine'

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

export function TopBar() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const [qr, setQr] = useState(false)
  const showGrid = useApp((s) => s.showGrid)
  if (mode === 'intro') return null
  const set = useApp.getState()
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
      <button className="pointer-events-auto glass flex items-center gap-3 rounded-full py-1.5 pl-2 pr-4" onClick={() => { set.select(null); set.setMode('intro') }}>
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <span className="font-display text-lg tracking-[0.15em]">HIERAPOLIS</span>
      </button>

      <nav className="pointer-events-auto glass order-3 mx-auto flex rounded-full p-1 sm:order-none">
        <button className={mode === 'explore' ? 'btn-active' : 'btn-ghost'} onClick={() => set.setMode('explore')}>{t('map3d')}</button>
        <button className={mode === 'plan' ? 'btn-active' : 'btn-ghost'} onClick={() => { set.setEra('ancient'); set.setMode('plan') }}>{t('plan')}</button>
        <button className={mode === 'tour' ? 'btn-active' : 'btn-ghost'} onClick={() => { set.select(null); set.setMode('tour'); set.setTour(0, true) }}>▶ {t('tour')}</button>
      </nav>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          className={'glass rounded-full px-3 py-1.5 text-xs ' + (showGrid ? 'bg-gold/80 text-ink' : 'btn-ghost')}
          onClick={() => set.setShowGrid(!showGrid)} aria-pressed={showGrid} title={t('wholeCityTip')}
        >⊞ {t('wholeCity')}</button>
        {mode !== 'plan' && (
          <div className="glass flex rounded-full p-1 text-xs">
            <button className={era === 'ancient' ? 'btn-active px-3 py-1' : 'btn-ghost px-3 py-1'} onClick={() => set.setEra('ancient')}>{t('ancient')}</button>
            <button className={era === 'today' ? 'btn-active px-3 py-1' : 'btn-ghost px-3 py-1'} onClick={() => set.setEra('today')}>{t('today')}</button>
          </div>
        )}
        <LangSwitch />
        <SoundMenu />
        <a className="glass btn-ghost hidden sm:inline-flex" href="#/guide" target="_blank" rel="noreferrer" title={t('guide')}>⎙</a>
        <button className="glass btn-ghost hidden sm:inline-flex" onClick={() => setQr((q) => !q)} title={t('scanToOpen')}>▦</button>
      </div>

      {qr && (
        <div className="pointer-events-auto absolute right-4 top-20 glass rounded-2xl p-4 text-center" onClick={() => setQr(false)}>
          <div className="rounded-xl bg-white p-3"><QRCodeSVG value={window.location.origin} size={180} /></div>
          <p className="mt-2 text-xs text-travertine/80">{t('scanToOpen')}</p>
          <p className="text-[11px] text-travertine/50">{window.location.host}</p>
        </div>
      )}
    </header>
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
