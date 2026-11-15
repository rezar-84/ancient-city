import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { useT } from '../i18n'
import { isAmbientEnabled, setAmbientEnabled } from './ambient'

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
  const [sound, setSound] = useState(isAmbientEnabled())
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
        <button className="glass btn-ghost" onClick={() => { setAmbientEnabled(!sound); setSound(!sound) }} title="Sound" aria-label="Sound">{sound ? '🔊' : '🔈'}</button>
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
