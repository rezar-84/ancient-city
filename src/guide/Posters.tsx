import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { ERAS, TIMELINE } from '../content/timeline'
import { PlanSVG } from './PlanSVG'
import { LangSwitch } from '../ui/TopBar'
import { useFit, usePrintPage } from './useFit'
import './print.css'

type Kind = 'overview' | 'plan' | 'timeline'
type Size = 'a3' | 'a2'
const tr = (lang: 'en' | 'tr', en: string, t: string) => (lang === 'en' ? en : t)
const HERO = ['theatre', 'frontinus-gate', 'apollo', 'martyrium', 'agora', 'baths']

/** Printable posters (#/poster): overview, archaeological plan and timeline, at A3 or A2. */
export default function Posters() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [kind, setKind] = useState<Kind>('overview')
  const [size, setSize] = useState<Size>('a3')
  const url = window.location.origin
  const [zoomed, setZoomed] = useState(false)
  const fit = useFit(size === 'a3' ? 297 : 420, zoomed)

  usePrintPage(size)

  const footer = (
    <footer className="absolute inset-x-[1.6em] bottom-[1.2em] flex items-center justify-between gap-[1em] border-t border-current pt-[0.6em] font-sans text-[0.8em] opacity-90">
      <div className="flex items-center gap-[0.8em]">
        <span className="rounded bg-white px-[0.4em] py-[0.25em]"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-[2.4em] w-auto" /></span>
        <span>{t('author')}</span>
      </div>
      <div className="flex items-center gap-[0.8em]">
        <span className="text-right">{t('scanToOpen')}<br /><b>{url.replace(/^https?:\/\//, '')}</b></span>
        <span className="rounded bg-white p-[0.3em]"><QRCodeSVG value={url} size={72} style={{ width: '4.2em', height: '4.2em' }} /></span>
      </div>
    </footer>
  )

  return (
    <div className="poster-wrap font-serif text-ink" style={{ ['--fit' as string]: fit }}>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-ink px-3 py-2 text-sm text-travertine sm:gap-3 sm:px-6 sm:py-3 sm:text-base">
        <div className="flex flex-wrap items-center gap-2">
          <a href="#/" className="btn-ghost">← Hierapolis 3D</a>
          <a href="#/guide" className="btn-ghost">⎙ {t('guide')}</a>
          <a href="#/wallmap" className="btn-ghost">▦ {tr(lang, 'A2 wall map', 'A2 duvar haritası')}</a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['overview', 'plan', 'timeline'] as Kind[]).map((k) => (
            <button key={k} className={kind === k ? 'btn-active' : 'btn-ghost'} onClick={() => setKind(k)}>
              {k === 'overview' ? tr(lang, 'Overview', 'Genel bakış') : k === 'plan' ? tr(lang, 'Plan', 'Plan') : tr(lang, 'Timeline', 'Zaman çizelgesi')}
            </button>
          ))}
          <span className="mx-1 opacity-40">|</span>
          {(['a3', 'a2'] as Size[]).map((s) => <button key={s} className={size === s ? 'btn-active' : 'btn-ghost'} onClick={() => setSize(s)}>{s.toUpperCase()}</button>)}
          <button className={'sm:hidden ' + (zoomed ? 'btn-active' : 'btn-ghost')} aria-pressed={zoomed} onClick={() => setZoomed((z) => !z)}>{zoomed ? tr(lang, '⤡ Fit', '⤡ Sığdır') : tr(lang, '⤢ Zoom', '⤢ Yakınlaştır')}</button>
          <LangSwitch />
          <button className="btn-gold" onClick={() => window.print()}>⎙ PDF</button>
        </div>
      </div>

      <div className={'poster ' + size} style={{ fontSize: size === 'a3' ? '11pt' : '15.5pt' }}>
        {kind === 'overview' && (
          <div className="relative flex h-full flex-col bg-ink text-travertine">
            <div className="relative h-[40em] shrink-0 bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(180deg, rgba(20,14,9,.25), rgba(20,14,9,.2) 45%, rgba(20,14,9,1)), url(/renders/theatre-2.jpg)' }}>
              <div className="px-[2.4em] pt-[2.4em]">
                <p className="font-sans text-[1em] uppercase tracking-[0.35em] text-gold">{t('tagline')}</p>
                <h1 className="mt-[0.2em] font-display text-[6.4em] leading-none tracking-[0.08em]">HIERAPOLIS</h1>
                <p className="mt-[0.3em] max-w-[34em] text-[1.9em] italic">{t('subtitle')}</p>
              </div>
            </div>
            <div className="relative z-10 -mt-[6em] grid shrink-0 grid-cols-3 gap-[0.9em] px-[2.4em]">
              {HERO.map((id) => {
                const l = LANDMARKS.find((x) => x.id === id)!
                return (
                  <figure key={id} className="overflow-hidden rounded-[0.5em] bg-black/40">
                    <img src={`/renders/${id}.jpg`} alt="" className="h-[10em] w-full object-cover" />
                    <figcaption className="h-[3.2em] px-[0.7em] py-[0.4em] leading-tight"><b className="font-display text-gold">{LANDMARKS.indexOf(l) + 1}</b> {l.name[lang]}<br /><span className="text-[0.8em] opacity-70">{l.period[lang]}</span></figcaption>
                  </figure>
                )
              })}
            </div>
            <div className="mt-[1.4em] grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-[1.6em] px-[2.4em] pb-[7em] text-[0.95em]">
              <div>
                <h2 className="font-display text-[1.7em] leading-tight text-gold">{tr(lang, 'Explore the Holy City in 3D', 'Kutsal Kenti 3B keşfedin')}</h2>
                <ul className="mt-[0.6em] space-y-[0.4em] text-[1.1em] leading-snug">
                  <li>◆ {tr(lang, '17 monuments rebuilt on the real terrain, with the whole street grid', 'Gerçek arazi üzerinde yeniden kurulan 17 anıt ve tüm sokak dokusu')}</li>
                  <li>◆ {tr(lang, 'Ancient and today views, archaeological plan with a timeline', 'Antik ve bugünkü görünümler, zaman çizelgeli arkeolojik plan')}</li>
                  <li>◆ {tr(lang, 'Narrated tour in English and Turkish; townspeople speak Greek, officials Latin', 'İngilizce ve Türkçe anlatımlı tur; kentliler Yunanca, görevliler Latince konuşur')}</li>
                  <li>◆ {tr(lang, 'Put the theatre on your table in AR', 'Tiyatroyu AR ile masanıza koyun')}</li>
                  <li>◆ {tr(lang, 'Printable visitor guide, posters and an A2 layered wall map', 'Yazdırılabilir ziyaretçi rehberi, posterler ve katmanlı A2 duvar haritası')}</li>
                </ul>
              </div>
              <div className="min-h-0 overflow-hidden rounded-[0.5em] border border-gold/40 bg-[#efe2c4]"><PlanSVG lang={lang} width={520} withLabels={false} fit /></div>
            </div>
            <div className="text-travertine">{footer}</div>
          </div>
        )}

        {kind === 'plan' && (
          <div className="relative h-full bg-parchment px-[2em] pt-[1.8em]">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-sans text-[0.9em] uppercase tracking-[0.3em] text-terracotta">{t('tagline')}</p>
                <h1 className="font-display text-[3.6em] leading-none tracking-[0.06em]">{tr(lang, 'Hierapolis — Archaeological Plan', 'Hierapolis — Arkeolojik Plan')}</h1>
              </div>
            </div>
            <div className="mt-[0.8em] h-[74em] overflow-hidden rounded-[0.4em] border border-ink/40 bg-[#efe2c4]"><PlanSVG lang={lang} width={1000} grid fit /></div>
            <ol className="mt-[0.8em] columns-3 gap-[1.4em] text-[1em]">
              {LANDMARKS.map((l, i) => <li key={l.id} className="break-inside-avoid"><b className="font-display text-terracotta">{i + 1}</b> {l.name[lang]} <span className="text-[0.8em] opacity-60">· {formatYear(l.built, lang)}</span></li>)}
            </ol>
            <p className="mt-[0.5em] text-[0.8em] italic opacity-70">{t('planNote')}</p>
            <div className="text-ink">{footer}</div>
          </div>
        )}

        {kind === 'timeline' && (
          <div className="relative h-full bg-[#f4ecdc] px-[2.2em] pt-[2em]">
            <p className="font-sans text-[0.9em] uppercase tracking-[0.3em] text-terracotta">{t('tagline')}</p>
            <h1 className="font-display text-[4em] leading-none tracking-[0.06em]">{tr(lang, 'Hierapolis through time', 'Zaman içinde Hierapolis')}</h1>
            <div className="mt-[1em] flex h-[1.4em] overflow-hidden rounded">{ERAS.map((e) => <div key={e.id} style={{ flex: e.to - e.from, background: e.color }} />)}</div>
            <div className="flex text-[0.75em]">{ERAS.map((e) => <div key={e.id} style={{ flex: e.to - e.from }} className="truncate pr-1">{e.label[lang]}</div>)}</div>
            <ol className="relative mt-[1.4em] border-l-2 border-terracotta/60 pl-[1.4em] text-[1.45em] leading-snug">
              {TIMELINE.map((e) => {
                const era = ERAS.find((x) => e.year >= x.from && e.year < x.to)
                return (
                  <li key={e.year + e.label.en} className="relative mb-[0.5em] break-inside-avoid">
                    <span className="absolute -left-[1.85em] top-[0.35em] h-[0.8em] w-[0.8em] rounded-full border-2 border-white" style={{ background: era?.color ?? '#b5653f' }} />
                    <span className="font-display text-terracotta">{formatYear(e.year, lang)}</span> — {e.label[lang]}
                  </li>
                )
              })}
            </ol>
            <div className="absolute inset-x-[2.2em] bottom-[6.6em] grid grid-cols-6 gap-[0.5em]">
              {HERO.map((id) => <img key={id} src={`/renders/${id}.jpg`} alt="" className="h-[9em] w-full rounded object-cover" />)}
            </div>
            <div className="text-ink">{footer}</div>
          </div>
        )}
      </div>
    </div>
  )
}
