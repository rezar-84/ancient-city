import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { useT } from '../i18n'
import { getAmbientVolume, isAmbientEnabled, onAmbientChange, setAmbientEnabled, setAmbientVolume } from './ambient'

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

/** Ambient-sound control: on/off switch and volume, remembered per browser. */
export function SoundMenu() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)
  useEffect(() => onAmbientChange(() => force((n) => n + 1)), [])
  const on = isAmbientEnabled()
  const vol = getAmbientVolume()
  const muted = !on || vol === 0
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
        <div className="glass absolute right-0 top-12 z-40 w-64 rounded-2xl p-4 text-sm">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>{t('ambience')}</span>
            <button
              role="switch" aria-checked={on}
              onClick={() => setAmbientEnabled(!on)}
              className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-amber-500' : 'bg-white/20'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
          <label className={`mt-3 block ${on ? '' : 'opacity-40'}`}>
            <span className="mb-1 flex justify-between text-xs text-travertine/70"><span>{t('volume')}</span><span>{Math.round(vol * 100)}%</span></span>
            <input
              type="range" min={0} max={100} step={5} value={Math.round(vol * 100)} disabled={!on}
              onChange={(e) => setAmbientVolume(Number(e.target.value) / 100)}
              className="w-full accent-amber-500"
            />
          </label>
          <p className="mt-3 text-[11px] leading-snug text-travertine/50">{t('soundNote')}</p>
        </div>
      )}
    </div>
  )
}
