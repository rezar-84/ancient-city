import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { lname } from '../content/types'
import { duckAmbient } from './ambient'
import type { Img } from '../content/types'

export function LandmarkPanel() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const era = useApp((s) => s.mode === 'plan' ? 'ancient' : s.era)
  const selected = useApp((s) => s.selected)
  const mode = useApp((s) => s.mode)
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const l = LANDMARKS.find((x) => x.id === selected)

  useEffect(() => { audio.current?.pause(); setPlaying(false) }, [selected, lang])
  useEffect(() => () => audio.current?.pause(), [])

  const open = !!l && mode !== 'tour' && mode !== 'intro'
  const src = l?.audio?.[lang]
  const toggleAudio = () => {
    if (!src) return
    if (playing) { audio.current?.pause(); setPlaying(false); duckAmbient(false); return }
    audio.current?.pause()
    audio.current = new Audio(src)
    audio.current.onended = () => { setPlaying(false); duckAmbient(false) }
    duckAmbient(true)
    void audio.current.play()
    setPlaying(true)
  }

  return (
    <aside
      className={
        'glass scroll-thin absolute z-20 overflow-y-auto transition-transform duration-500 ease-out ' +
        'inset-x-0 bottom-0 max-h-[62vh] rounded-t-3xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:max-h-none sm:w-[420px] sm:rounded-3xl ' +
        (open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-[110%]')
      }
      aria-hidden={!open}
    >
      {l && (
        <div>
          <Gallery key={l.id + lang} renders={l.renders ?? []} photos={l.images} name={lname(l, lang, era)} />
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-gold">{l.period[lang]}</p>
                <h2 className="mt-1 font-display text-2xl leading-tight">{lname(l, lang, era)}</h2>
                <p className="mt-0.5 text-xs text-travertine/50">{formatYear(l.built, lang)}{l.until ? ` – ${formatYear(l.until, lang)}` : ''}</p>
              </div>
              <button className="btn-ghost -mr-2 -mt-1 h-9 w-9 justify-center p-0 text-lg" onClick={() => useApp.getState().select(null)} aria-label={t('close')}>✕</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {src && <button className="btn-gold" onClick={toggleAudio}>{playing ? '■ ' + t('stop') : '▶ ' + t('listen')}</button>}
              {mode === 'plan' && <button className="btn border border-white/20 hover:bg-white/10" onClick={() => useApp.getState().setMode('explore')}>◭ {t('seeIn3d')}</button>}
              {l.model && <button className="btn border border-white/20 hover:bg-white/10" onClick={() => useApp.getState().setAR(true)}>◈ {t('ar')}</button>}
            </div>

            <p className="mt-4 font-serif text-[17px] leading-relaxed text-travertine/95">{l.summary[lang]}</p>

            {l.facts[lang].length > 0 && (
              <>
                <h3 className="mt-5 text-[11px] uppercase tracking-[0.2em] text-travertine/50">{t('facts')}</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-travertine/85">
                  {l.facts[lang].map((f, i) => (
                    <li key={i} className="flex gap-2"><span className="text-gold">◆</span><span>{f}</span></li>
                  ))}
                </ul>
              </>
            )}

            {l.didYouKnow && (
              <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{t('didYouKnow')}</p>
                <p className="mt-1 font-serif text-[15px] italic leading-relaxed">{l.didYouKnow[lang]}</p>
              </div>
            )}

            {l.disputed && (
              <div className="mt-3 rounded-2xl border border-white/15 p-4 text-sm text-travertine/80">
                <p className="text-[11px] uppercase tracking-[0.2em] text-travertine/50">⚑ {t('disputed')}</p>
                <p className="mt-1">{l.disputed[lang]}</p>
              </div>
            )}

            <h3 className="mt-5 text-[11px] uppercase tracking-[0.2em] text-travertine/50">{t('sources')}</h3>
            <ul className="mt-1 space-y-0.5 text-xs">
              {l.sources.map((s) => (
                <li key={s.url}><a className="text-aegean-300 underline decoration-white/20 underline-offset-2 hover:text-white text-[#8cc6d8]" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] italic text-travertine/40">{t('reconstruction')}</p>
          </div>
        </div>
      )}
    </aside>
  )
}

function Gallery({ renders, photos, name }: { renders: string[]; photos: Img[]; name: string }) {
  const t = useT()
  const today = photos.filter((p) => p.kind !== 'archive')
  const archive = photos.filter((p) => p.kind === 'archive')
  const tabs = [
    { id: 'render', label: '◭ ' + t('tabRender'), items: renders.map((src) => ({ src, credit: t('reconstruction') }) as Img) },
    { id: 'today', label: '◉ ' + t('tabToday'), items: today },
    { id: 'archive', label: '✎ ' + t('tabArchive'), items: archive },
  ].filter((x) => x.items.length > 0)
  const [tab, setTab] = useState(tabs[0]?.id)
  const [i, setI] = useState(0)
  const [zoom, setZoom] = useState(false)
  const items = tabs.find((x) => x.id === tab)?.items ?? []
  if (!tabs.length) return null
  const cur = items[Math.min(i, items.length - 1)]
  return (
    <figure className="relative">
      {cur && <img src={cur.src} alt={cur.title ?? name} className="h-60 w-full cursor-zoom-in rounded-t-3xl bg-black/30 object-cover" loading="lazy" onClick={() => setZoom(true)} />}
      <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-1 text-[11px]">
        {tabs.map((x) => (
          <button key={x.id} className={'rounded-full px-2.5 py-1 backdrop-blur ' + (tab === x.id ? 'bg-travertine text-ink' : 'bg-black/55 text-white/85')} onClick={() => { setTab(x.id); setI(0) }}>
            {x.label} <span className="opacity-60">{x.items.length}</span>
          </button>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white" onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="previous">‹</button>
          <button className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white" onClick={() => setI((i + 1) % items.length)} aria-label="next">›</button>
        </>
      )}
      {cur && <figcaption className="absolute bottom-1.5 left-3 right-3 truncate text-[10px] text-white/80 drop-shadow">{cur.title ? cur.title + ' — ' : ''}{cur.credit}</figcaption>}
      {zoom && cur && <Lightbox items={items} index={Math.min(i, items.length - 1)} onClose={() => setZoom(false)} />}
    </figure>
  )
}

/** Full-screen image viewer with captions and credits. */
export function Lightbox({ items, index, onClose }: { items: Img[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'ArrowRight') setI((k) => (k + 1) % items.length)
      if (e.key === 'ArrowLeft') setI((k) => (k - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', on, true)
    return () => window.removeEventListener('keydown', on, true)
  }, [items.length, onClose])
  const cur = items[i]
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/92 p-4 backdrop-blur" onClick={onClose}>
      <div className="flex justify-end"><button className="btn-ghost text-xl" aria-label="close">✕</button></div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img src={cur.src} alt={cur.title ?? ''} className="max-h-full max-w-full object-contain" />
        {items.length > 1 && <>
          <button className="absolute left-0 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white" onClick={() => setI((i - 1 + items.length) % items.length)}>‹</button>
          <button className="absolute right-0 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white" onClick={() => setI((i + 1) % items.length)}>›</button>
        </>}
      </div>
      <p className="mx-auto mt-3 max-w-4xl text-center font-serif text-base text-white/90">{cur.title}</p>
      <p className="mx-auto max-w-4xl text-center text-xs text-white/55">{cur.credit}{cur.url ? <> · <a className="underline" href={cur.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>source</a></> : null} · {i + 1}/{items.length}</p>
    </div>,
    document.body,
  )
}
