import { useApp } from '../store'
import { useT } from '../i18n'
import { LangSwitch } from './TopBar'
import { startAmbient } from './ambient'
import { goToViewpoint } from './Viewpoints'

export function Intro() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const hidden = mode !== 'intro'
  return (
    <div
      className={
        'pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-[12vh] text-center transition-opacity duration-1000 ' +
        (hidden ? 'opacity-0' : 'opacity-100')
      }
      style={{ background: 'radial-gradient(ellipse at 50% 30%, transparent 30%, rgba(20,14,9,.75) 100%)' }}
      aria-hidden={hidden}
    >
      <div className="absolute right-5 top-5 pointer-events-auto">{!hidden && <LangSwitch />}</div>
      <p className="mb-3 font-sans text-xs uppercase tracking-[0.35em] text-gold">{t('tagline')}</p>
      <h1 className="font-display text-6xl font-bold tracking-[0.12em] text-travertine drop-shadow-[0_4px_30px_rgba(0,0,0,.6)] sm:text-8xl">
        {t('title').toUpperCase()}
      </h1>
      <p className="mt-4 max-w-xl px-6 font-serif text-xl italic text-travertine/90 sm:text-2xl">{t('subtitle')}</p>
      {!hidden && (
        <div className="pointer-events-auto mt-10 flex flex-wrap justify-center gap-3 px-4">
          <button className="btn-gold px-7 py-3 text-base" onClick={() => { startAmbient(); useApp.getState().setMode('explore') }}>
            {t('explore')}
          </button>
          <button
            className="btn px-7 py-3 text-base border border-travertine/40 text-travertine hover:bg-white/10"
            onClick={() => { startAmbient(); useApp.getState().setMode('tour'); useApp.getState().setTour(0, true) }}
          >
            ▶ {t('tour')}
          </button>
          <button
            className="btn px-7 py-3 text-base border border-travertine/40 text-travertine hover:bg-white/10"
            onClick={() => { startAmbient(); useApp.getState().setMode('explore'); setTimeout(() => goToViewpoint('pamukkale', 3.5), 50) }}
          >
            ◐ Pamukkale
          </button>
        </div>
      )}
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 px-4 sm:flex-row sm:justify-center sm:gap-4">
        <span className="rounded-lg bg-white/95 px-2.5 py-1.5 shadow-lg"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-7 w-auto sm:h-8" /></span>
        <p className="text-center font-sans text-[11px] tracking-[0.12em] text-travertine/65">{t('author')}</p>
      </div>
    </div>
  )
}
