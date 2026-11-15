import { useApp } from '../store'
import { useT } from '../i18n'
import { LangSwitch, SoundMenu } from './TopBar'
import { startAmbient } from './ambient'
import { goToViewpoint } from './Viewpoints'

export function Intro() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const hidden = mode !== 'intro'
  return (
    <div
      className={
        'pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-[150px] text-center transition-opacity duration-1000 sm:pb-[12vh] ' +
        (hidden ? 'opacity-0' : 'opacity-100')
      }
      style={{ background: 'radial-gradient(ellipse at 50% 30%, transparent 30%, rgba(20,14,9,.75) 100%)' }}
      aria-hidden={hidden}
    >
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] pointer-events-auto flex items-center gap-2 sm:right-5 sm:top-5">{!hidden && <><SoundMenu /><LangSwitch /></>}</div>
      <p className="mb-3 max-w-[22rem] px-6 font-sans text-[10px] uppercase leading-relaxed tracking-[0.25em] text-gold sm:max-w-none sm:text-xs sm:tracking-[0.35em]">{t('tagline')}</p>
      <h1 className="font-display text-[13.5vw] font-bold leading-none tracking-[0.06em] text-travertine drop-shadow-[0_4px_30px_rgba(0,0,0,.6)] sm:text-8xl sm:tracking-[0.12em]">
        {t('title').toUpperCase()}
      </h1>
      <p className="mt-3 max-w-xl px-6 font-serif text-lg italic text-travertine/90 sm:mt-4 sm:text-2xl">{t('subtitle')}</p>
      {!hidden && (
        <div className="pointer-events-auto mt-7 flex w-full max-w-sm flex-col gap-2.5 px-6 sm:mt-10 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 sm:px-4">
          <button className="btn-gold justify-center px-7 py-3 text-base" onClick={() => { startAmbient(); useApp.getState().setMode('explore') }}>
            {t('explore')}
          </button>
          <button
            className="btn justify-center border border-travertine/40 px-7 py-3 text-base text-travertine hover:bg-white/10"
            onClick={() => { startAmbient(); useApp.getState().setMode('tour'); useApp.getState().setTour(0, true) }}
          >
            ▶ {t('tour')}
          </button>
          <button
            className="btn justify-center border border-travertine/40 px-7 py-3 text-base text-travertine hover:bg-white/10"
            onClick={() => { startAmbient(); useApp.getState().setMode('explore'); setTimeout(() => goToViewpoint('pamukkale', 3.5), 50) }}
          >
            ◐ Pamukkale
          </button>
        </div>
      )}
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 flex flex-col items-center gap-2 px-4 sm:flex-row sm:justify-center sm:gap-4">
        <span className="rounded-lg bg-white/95 px-2.5 py-1.5 shadow-lg"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-7 w-auto sm:h-8" /></span>
        <p className="text-center font-sans text-[11px] tracking-[0.12em] text-travertine/65">{t('author')}</p>
      </div>
    </div>
  )
}
