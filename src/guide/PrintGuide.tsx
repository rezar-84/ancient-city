import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { TIMELINE, ERAS } from '../content/timeline'
import { CREDITS } from '../content/credits'
import { PlanSVG } from './PlanSVG'
import { LangSwitch } from '../ui/TopBar'
import './print.css'

/** A4 printable visitor guide: open #/guide and use the browser's Print → Save as PDF. */
export default function PrintGuide() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  useEffect(() => { document.body.classList.add('printing'); return () => document.body.classList.remove('printing') }, [])
  const url = window.location.origin
  const intro = lang === 'en'
    ? 'Hierapolis — the “Holy City” — was founded in the early 2nd century BC by the Attalid kings of Pergamon beside hot springs whose mineral-rich water built the dazzling white travertine terraces of Pamukkale (“cotton castle”). Under Rome it became a prosperous spa and textile centre with a theatre, baths, temples and one of the largest cemeteries of the ancient world. In Christian times pilgrims came to the shrine of the Apostle Philip, martyred here according to tradition. This guide follows the interactive 3D experience: each number matches the plan.'
    : 'Hierapolis — “Kutsal Kent” — MÖ 2. yüzyılın başında Bergama Attalos krallarınca, mineral yüklü suları Pamukkale’nin göz kamaştıran beyaz travertenlerini oluşturan sıcak su kaynaklarının yanında kuruldu. Roma döneminde tiyatrosu, hamamları, tapınakları ve antik dünyanın en büyük mezarlıklarından biriyle zengin bir kaplıca ve dokuma kentine dönüştü. Hristiyanlık döneminde, geleneğe göre burada şehit edilen Havari Philippos’un türbesine hacılar geldi. Bu rehber etkileşimli 3B deneyimi izler: her numara plandakiyle eşleşir.'

  return (
    <div className="guide font-serif text-ink">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-ink px-6 py-3 text-travertine">
        <a href="#/" className="btn-ghost">← Hierapolis 3D</a>
        <div className="flex items-center gap-3"><LangSwitch /><button className="btn-gold" onClick={() => window.print()}>⎙ {t('guide')} / PDF</button></div>
      </div>

      {/* cover */}
      <section className="page cover" style={{ backgroundImage: `linear-gradient(180deg, rgba(20,14,9,.15), rgba(20,14,9,.85)), url(${LANDMARKS.find((l) => l.id === 'theatre')?.images[0]?.src ?? ''})` }}>
        <div className="mt-auto p-[18mm] text-travertine">
          <p className="font-sans text-[10pt] uppercase tracking-[0.35em] text-gold">{t('tagline')}</p>
          <h1 className="mt-2 font-display text-[54pt] leading-none tracking-[0.1em]">HIERAPOLIS</h1>
          <p className="mt-3 max-w-[140mm] text-[16pt] italic">{t('subtitle')}</p>
          <p className="mt-6 font-sans text-[9pt] opacity-70">{lang === 'en' ? 'Visitor guide to the interactive 3D experience' : 'Etkileşimli 3B deneyim için ziyaretçi rehberi'}</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="rounded bg-white px-2 py-1.5"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-[11mm] w-auto" /></span>
            <p className="font-sans text-[9pt] opacity-80">{t('author')}</p>
          </div>
        </div>
      </section>

      {/* intro + timeline */}
      <section className="page p-[16mm]">
        <h2 className="h2">{lang === 'en' ? 'The Holy City' : 'Kutsal Kent'}</h2>
        <p className="mt-3 text-[12pt] leading-relaxed">{intro}</p>
        <h2 className="h2 mt-8">{lang === 'en' ? 'Timeline' : 'Zaman çizelgesi'}</h2>
        <div className="mt-2 flex h-2 overflow-hidden rounded">{ERAS.map((e) => <div key={e.id} style={{ flex: e.to - e.from, background: e.color }} />)}</div>
        <ol className="mt-4 columns-2 gap-8 text-[10pt]">
          {TIMELINE.map((e) => (
            <li key={e.year + e.label.en} className="mb-2 break-inside-avoid">
              <span className="font-display text-terracotta">{formatYear(e.year, lang)}</span> — {e.label[lang]}
            </li>
          ))}
        </ol>
      </section>

      {/* plan */}
      <section className="page p-[12mm]">
        <h2 className="h2">{t('plan')}</h2>
        <div className="mt-3 overflow-hidden rounded border border-ink/30"><PlanSVG lang={lang} width={760} /></div>
        <ol className="mt-3 columns-3 gap-6 text-[9pt]">
          {LANDMARKS.map((l, i) => <li key={l.id}><b className="font-display text-terracotta">{i + 1}</b> {l.name[lang]}</li>)}
        </ol>
        <p className="mt-2 text-[8pt] italic opacity-70">{t('planNote')}</p>
      </section>

      {/* landmark cards */}
      {chunk(LANDMARKS.map((l, i) => ({ l, n: i + 1 })), 2).map((pair, pi) => (
        <section key={pi} className="page p-[14mm]">
          {pair.map(({ l, n }) => (
            <article key={l.id} className="card">
              {l.images[0] && <img src={l.images[0].src} alt="" className="h-[62mm] w-[70mm] shrink-0 rounded object-cover" />}
              <div className="min-w-0">
                <p className="font-sans text-[8pt] uppercase tracking-[0.2em] text-terracotta">{n} · {l.period[lang]}</p>
                <h3 className="font-display text-[17pt] leading-tight">{l.name[lang]}</h3>
                <p className="mt-1.5 text-[10.5pt] leading-snug">{l.summary[lang]}</p>
                <ul className="mt-1.5 text-[9pt] leading-snug">{l.facts[lang].slice(0, 4).map((f, i) => <li key={i}>◆ {f}</li>)}</ul>
                {l.didYouKnow && <p className="mt-1.5 text-[9pt] italic"><b>{t('didYouKnow')}</b> {l.didYouKnow[lang]}</p>}
                {l.images[0] && <p className="mt-1 font-sans text-[6.5pt] opacity-60">Photo: {l.images[0].credit}</p>}
              </div>
            </article>
          ))}
        </section>
      ))}

      {/* credits */}
      <section className="page p-[16mm]">
        <h2 className="h2">{t('sources')} & {t('credits')}</h2>
        <div className="mt-4 flex items-start gap-8">
          <div className="text-center"><QRCodeSVG value={url} size={120} /><p className="mt-1 font-sans text-[8pt]">{t('scanToOpen')}</p><p className="font-sans text-[8pt] opacity-60">{url.replace(/^https?:\/\//, '')}</p></div>
          <ul className="text-[8.5pt] leading-snug">
            {Array.from(new Map(LANDMARKS.flatMap((l) => l.sources).map((s) => [s.url, s])).values()).map((s) => <li key={s.url}>{s.title} — <span className="opacity-60">{s.url}</span></li>)}
          </ul>
        </div>
        <h3 className="mt-6 font-display text-[12pt]">{t('credits')}</h3>
        <ul className="mt-1 text-[8pt] leading-snug opacity-80">{CREDITS.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="mt-4 text-[8pt] italic opacity-60">{t('reconstruction')}.</p>
        <div className="mt-3 flex items-center gap-3"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-[10mm] w-auto" /><p className="text-[9pt]">{t('author')}</p></div>
      </section>
    </div>
  )
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}
