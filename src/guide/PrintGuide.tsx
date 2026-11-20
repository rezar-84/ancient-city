import { useMemo, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { TIMELINE, ERAS } from '../content/timeline'
import { CREDITS } from '../content/credits'
import { GLOSSARY, NUMBERS } from './printContent'
import { HISTORIC_MAPS } from '../content/images'
import { GRID } from '../content/grid'
import { LANG_LABEL, PLACE_SOUND, VOICES, langForYear } from '../content/soundscapes'
import { PlanSVG } from './PlanSVG'
import { PhaseMaps, useTerrain } from './WallMap'
import { hillshadeURL } from './mapData'
import { LangSwitch } from '../ui/TopBar'
import type { Landmark } from '../content/types'
import { useFit, usePrintPage } from './useFit'
import './print.css'

type Lang = 'en' | 'tr'
const SITE = 'ar.ferially.com'
const tr = (lang: Lang, en: string, trs: string) => (lang === 'en' ? en : trs)

/** Running footer on every page: author credit, page number, site. */
function Page({ n, children, className = '', dark = false }: { n: number; children: ReactNode; className?: string; dark?: boolean }) {
  const t = useT()
  return (
    <section className={'page ' + className}>
      {children}
      <footer className={'page-foot ' + (dark ? 'text-travertine/80' : 'text-ink/60')}>
        <span>Hierapolis Reborn · {t('author')}</span>
        <span>{SITE} · {n}</span>
      </footer>
    </section>
  )
}

function voiceFor(l: Landmark) {
  const ps = PLACE_SOUND[l.id]
  const id = ps?.voice?.[langForYear(l.built)]
  return id ? VOICES.find((v) => v.id === id) : undefined
}

/** A4 printable visitor guide: open #/guide and use the browser's Print → Save as PDF. */
export default function PrintGuide() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  usePrintPage('a4')
  const fit = useFit(210)
  const terrain = useTerrain()
  const relief = useMemo(() => (terrain ? hillshadeURL(terrain) : null), [terrain])
  const url = window.location.origin
  const intro = tr(lang,
    'Hierapolis — the “Holy City” — was founded in the early 2nd century BC by the Attalid kings of Pergamon beside hot springs whose mineral-rich water built the dazzling white travertine terraces of Pamukkale (“cotton castle”). Under Rome it became a prosperous spa and textile centre with a theatre, baths, temples and one of the largest cemeteries of the ancient world. In Christian times pilgrims came to the shrine of the Apostle Philip, martyred here according to tradition. This guide follows the interactive 3D experience: each number matches the plan.',
    'Hierapolis — “Kutsal Kent” — MÖ 2. yüzyılın başında Bergama Attalos krallarınca, mineral yüklü suları Pamukkale’nin göz kamaştıran beyaz travertenlerini oluşturan sıcak su kaynaklarının yanında kuruldu. Roma döneminde tiyatrosu, hamamları, tapınakları ve antik dünyanın en büyük mezarlıklarından biriyle zengin bir kaplıca ve dokuma kentine dönüştü. Hristiyanlık döneminde, geleneğe göre burada şehit edilen Havari Philippos’un türbesine hacılar geldi. Bu rehber etkileşimli 3B deneyimi izler: her numara plandakiyle eşleşir.')

  let n = 0
  const next = () => ++n
  const voicePlaces = LANDMARKS.filter((l) => PLACE_SOUND[l.id]?.voice)

  return (
    <div className="guide font-serif text-ink" style={{ ['--fit' as string]: fit }}>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-ink px-3 py-2 text-sm text-travertine sm:gap-3 sm:px-6 sm:py-3 sm:text-base">
        <a href="#/" className="btn-ghost">← Hierapolis 3D</a>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <a href="#/poster" className="btn-ghost">▭ {tr(lang, 'Posters', 'Posterler')}</a>
          <a href="#/wallmap" className="btn-ghost">▦ {tr(lang, 'A2 wall map', 'A2 duvar haritası')}</a>
          <LangSwitch />
          <button className="btn-gold" onClick={() => window.print()}>⎙ {t('guide')} / PDF</button>
        </div>
      </div>

      {/* cover */}
      <Page n={next()} dark className="cover" >
        <div className="cover-bg" style={{ backgroundImage: `linear-gradient(180deg, rgba(20,14,9,.1), rgba(20,14,9,.88)), url(/renders/theatre-2.jpg)` }} />
        <div className="relative mt-auto p-[18mm] pb-[26mm] text-travertine">
          <p className="font-sans text-[10pt] uppercase tracking-[0.35em] text-gold">{t('tagline')}</p>
          <h1 className="mt-2 font-display text-[54pt] leading-none tracking-[0.1em]">HIERAPOLIS</h1>
          <p className="mt-3 max-w-[140mm] text-[16pt] italic">{t('subtitle')}</p>
          <p className="mt-6 font-sans text-[9pt] opacity-70">{tr(lang, 'Visitor guide to the interactive 3D experience', 'Etkileşimli 3B deneyim için ziyaretçi rehberi')}</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="rounded bg-white px-2 py-1.5"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-[11mm] w-auto" /></span>
            <p className="font-sans text-[10pt]">{t('author')}</p>
          </div>
        </div>
      </Page>

      {/* intro + numbers + contents */}
      <Page n={next()} className="p-[16mm]">
        <h2 className="h2">{tr(lang, 'The Holy City', 'Kutsal Kent')}</h2>
        <p className="mt-3 text-[11.5pt] leading-relaxed">{intro}</p>
        <h2 className="h2 mt-7">{tr(lang, 'The city in numbers', 'Rakamlarla kent')}</h2>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {NUMBERS.map((x) => (
            <div key={x.v + x.en} className="rounded border border-ink/15 bg-parchment/50 p-2.5">
              <p className="font-display text-[17pt] leading-none text-terracotta">{x.v}</p>
              <p className="mt-1 text-[8.5pt] leading-snug">{x[lang]}</p>
            </div>
          ))}
        </div>
        <h2 className="h2 mt-7">{tr(lang, 'In this guide', 'Bu rehberde')}</h2>
        <ol className="mt-2 columns-2 gap-8 text-[10pt] leading-relaxed">
          <li>{tr(lang, 'Timeline', 'Zaman çizelgesi')} — 3</li>
          <li>{tr(lang, 'Archaeological plan', 'Arkeolojik plan')} — 4</li>
          <li>{tr(lang, 'The street grid', 'Sokak dokusu')} — 5</li>
          <li>{tr(lang, 'The city through time', 'Zaman içinde kent')} — 6</li>
          <li>{tr(lang, 'Historic maps', 'Tarihî haritalar')} — 7</li>
          {LANDMARKS.map((l, i) => <li key={l.id}><b className="font-display text-terracotta">{i + 1}</b> {l.name[lang]} — {8 + i}</li>)}
          <li>{tr(lang, 'Ancient voices', 'Antik sesler')} — {8 + LANDMARKS.length}</li>
          <li>{tr(lang, 'Glossary', 'Sözlük')} — {9 + LANDMARKS.length}</li>
          <li>{t('sources')} & {t('credits')} — {10 + LANDMARKS.length}</li>
        </ol>
        <p className="mt-5 rounded border border-gold/50 bg-parchment/40 px-3 py-2 text-[9.5pt] leading-snug">▦ {tr(lang, 'Also to print: an A2 wall map with switchable layers (terrain, contours, excavated remains, walls, streets, tour route) and callouts for every monument —', 'Ayrıca basılabilir: değiştirilebilir katmanlı (arazi, eş yükselti, kazılmış kalıntılar, surlar, caddeler, tur güzergâhı) ve her anıt için açıklamalı A2 duvar haritası —')} <b>{SITE}/#/wallmap</b></p>
      </Page>

      {/* timeline */}
      <Page n={next()} className="p-[16mm]">
        <h2 className="h2">{tr(lang, 'Timeline', 'Zaman çizelgesi')}</h2>
        <div className="mt-3 flex h-3 overflow-hidden rounded">{ERAS.map((e) => <div key={e.id} style={{ flex: e.to - e.from, background: e.color }} />)}</div>
        <div className="mt-1 flex text-[7.5pt]">{ERAS.map((e) => <div key={e.id} style={{ flex: e.to - e.from }} className="truncate pr-1">{e.label[lang]}</div>)}</div>
        <ol className="mt-5 columns-2 gap-8 text-[10pt]">
          {TIMELINE.map((e) => (
            <li key={e.year + e.label.en} className="mb-2.5 break-inside-avoid">
              <span className="font-display text-terracotta">{formatYear(e.year, lang)}</span> — {e.label[lang]}
              {e.detail && <span className="block text-[8.5pt] opacity-75">{e.detail[lang]}</span>}
            </li>
          ))}
        </ol>
      </Page>

      {/* plan */}
      <Page n={next()} className="p-[12mm]">
        <h2 className="h2">{t('plan')}</h2>
        <div className="mt-3 h-[196mm] overflow-hidden rounded border border-ink/30 bg-[#efe2c4]"><PlanSVG lang={lang} width={760} fit /></div>
        <ol className="mt-3 columns-3 gap-6 text-[9pt]">
          {LANDMARKS.map((l, i) => <li key={l.id}><b className="font-display text-terracotta">{i + 1}</b> {l.name[lang]}</li>)}
        </ol>
        <p className="mt-2 text-[8pt] italic opacity-70">{t('planNote')}</p>
      </Page>

      {/* grid */}
      <Page n={next()} className="p-[12mm]">
        <h2 className="h2">{tr(lang, 'The street grid', 'Sokak dokusu')}</h2>
        <p className="mt-2 text-[10.5pt] leading-snug">{tr(lang,
          'Hierapolis was laid out on a regular Hippodamian grid that the Romans kept: narrow side streets (stenopoi, about 3 m wide) cross the 13.5 m wide colonnaded plateia at right angles roughly every 35 m, and further streets run parallel to it. Excavators number the cross streets and letter the parallel ones — for example, Insula 104 lies between stenopoi 18 and 19 and plateiai D and E. Switch on “City details” in the 3D view to see every block rebuilt.',
          'Hierapolis, Romalıların da koruduğu düzenli bir Hippodamik ızgara üzerine kuruldu: dar yan sokaklar (stenopoi, yaklaşık 3 m) 13,5 m genişliğindeki sütunlu plateiayı yaklaşık her 35 m’de bir dik açıyla keser, başka caddeler de ona paralel uzanır. Kazıcılar kesişen sokakları numaralar, paralel olanları harflerle gösterir — örneğin İnsula 104, 18 ve 19 numaralı stenopoi ile D ve E plateiaları arasındadır. Her adanın canlandırmasını görmek için 3B görünümde “Kent ayrıntıları”nı açın.')}</p>
        <div className="mt-3 h-[178mm] overflow-hidden rounded border border-ink/30 bg-[#efe2c4]"><PlanSVG lang={lang} width={760} grid withLabels={false} fit /></div>
        <p className="mt-2 text-[8pt] italic opacity-70">{GRID.note[lang]}</p>
      </Page>

      {/* the city through time */}
      <Page n={next()} className="p-[14mm]">
        <h2 className="h2">{tr(lang, 'The city through time', 'Zaman içinde kent')}</h2>
        <p className="mt-2 text-[10pt] leading-snug">{tr(lang,
          'The same plan at four dates, showing the monuments of this guide that were standing or in use. Dates of construction and abandonment are approximate; several buildings were repaired or changed use many times.',
          'Aynı plan dört farklı tarihte; bu rehberdeki anıtlardan ayakta olan ya da kullanılanları gösterir. Yapım ve terk tarihleri yaklaşıktır; pek çok yapı defalarca onarılmış ya da işlev değiştirmiştir.')}</p>
        <div className="relative mt-4" style={{ height: '222mm' }}>
          <PhaseMaps r={{ x: 0, y: 0, w: 182, h: 222 }} cols={2} theme="parchment" lang={lang} relief={relief} />
        </div>
      </Page>

      {/* historic maps */}
      <Page n={next()} className="p-[12mm]">
        <h2 className="h2">{tr(lang, 'Historic maps & plans', 'Tarihî harita ve planlar')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {HISTORIC_MAPS.slice(0, 4).map((m) => (
            <figure key={m.src} className="break-inside-avoid">
              <img src={m.src} alt="" className="h-[105mm] w-full rounded border border-ink/20 bg-white object-contain" />
              <figcaption className="mt-1 text-[8.5pt] leading-snug"><b>{m.title}</b><br /><span className="opacity-60">{m.credit}</span></figcaption>
            </figure>
          ))}
        </div>
      </Page>

      {/* one page per monument */}
      {LANDMARKS.map((l, i) => {
        const photo = l.images.find((im) => im.kind !== 'archive') ?? l.images[0]
        const archive = l.images.find((im) => im.kind === 'archive')
        const render = l.renders?.[0]
        const v = voiceFor(l)
        return (
          <Page key={l.id} n={next()} className="p-[13mm]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[8pt] uppercase tracking-[0.2em] text-terracotta">{i + 1} · {l.period[lang]}</p>
                <h2 className="font-display text-[24pt] leading-tight">{l.name[lang]}</h2>
                {l.nameToday && <p className="text-[9.5pt] italic opacity-70">{tr(lang, 'Today', 'Bugün')}: {l.nameToday[lang]}</p>}
              </div>
              <div className="shrink-0 text-center">
                <QRCodeSVG value={`${url}/#/place/${l.id}`} size={64} />
                <p className="font-sans text-[6.5pt] opacity-60">{tr(lang, 'open in 3D', '3B’de aç')}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {render ? <figure><img src={render} alt="" className="h-[62mm] w-full rounded object-cover" /><figcaption className="mt-0.5 font-sans text-[6.5pt] opacity-60">{tr(lang, '3D reconstruction', '3B canlandırma')} — {t('reconstruction')}</figcaption></figure> : archive && <figure><img src={archive.src} alt="" className="h-[62mm] w-full rounded bg-white object-contain" /><figcaption className="mt-0.5 font-sans text-[6.5pt] opacity-60">{archive.credit}</figcaption></figure>}
              {photo && <figure><img src={photo.src} alt="" className="h-[62mm] w-full rounded object-cover" /><figcaption className="mt-0.5 truncate font-sans text-[6.5pt] opacity-60">{tr(lang, 'Today', 'Bugün')} — {photo.credit}</figcaption></figure>}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_58mm] gap-5">
              <div>
                <p className="text-[10.5pt] leading-snug">{l.summary[lang]}</p>
                <h3 className="mt-3 font-display text-[11pt] text-terracotta">{tr(lang, 'Key facts', 'Önemli bilgiler')}</h3>
                <ul className="mt-1 text-[9.5pt] leading-snug">{l.facts[lang].map((f, k) => <li key={k} className="mb-0.5">◆ {f}</li>)}</ul>
                {l.didYouKnow && <p className="mt-2.5 text-[9.5pt] italic"><b>{t('didYouKnow')}</b> {l.didYouKnow[lang]}</p>}
                {l.disputed && <p className="mt-2.5 rounded border border-terracotta/25 bg-parchment/40 px-2 py-1 text-[9pt]"><b>⚑ {tr(lang, 'Debated by scholars', 'Akademisyenlerce tartışmalı')}:</b> {l.disputed[lang]}</p>}
                {v && (
                  <div className="mt-2.5 text-[9pt]">
                    <b>{tr(lang, 'Ancient voice', 'Antik ses')} · {LANG_LABEL[v.lang][lang]}</b>
                    <p className="italic">{v.text}</p>
                    <p className="opacity-75">“{v.gloss[lang]}” — {v.source}</p>
                  </div>
                )}
              </div>
              <aside className="text-[8.5pt]">
                <div className="overflow-hidden rounded border border-ink/25"><PlanSVG lang={lang} width={420} withLabels={false} highlight={l.id} /></div>
                <dl className="mt-2 space-y-1">
                  <div><dt className="inline font-semibold">{tr(lang, 'Built', 'Yapım')}: </dt><dd className="inline">{formatYear(l.built, lang)}</dd></div>
                  {l.until !== undefined && <div><dt className="inline font-semibold">{tr(lang, 'In use until', 'Kullanım sonu')}: </dt><dd className="inline">{formatYear(l.until, lang)}</dd></div>}
                  <div><dt className="inline font-semibold">{tr(lang, 'Location', 'Konum')}: </dt><dd className="inline">{l.lat.toFixed(5)}° N, {l.lon.toFixed(5)}° E</dd></div>
                </dl>
                <h4 className="mt-2 font-semibold">{t('sources')}</h4>
                <ul className="leading-snug opacity-80">{l.sources.map((s) => <li key={s.url}>{s.title}</li>)}</ul>
              </aside>
            </div>
          </Page>
        )
      })}

      {/* ancient voices */}
      <Page n={next()} className="p-[16mm]">
        <h2 className="h2">{tr(lang, 'Ancient voices', 'Antik sesler')}</h2>
        <p className="mt-2 text-[10pt] leading-snug">{tr(lang,
          'In the 3D view each place has its own soundscape, and selecting a temple, theatre, gate, market or church plays a short text in the language of its period: Greek in Hellenistic times, Koine Greek in the Roman city, Byzantine Greek in the Christian city. Hierapolis stayed Greek-speaking under Rome, so townspeople speak Koine; Latin is kept for officials and imperial dedications such as the one on the Frontinus Gate. Pronunciation is approximate.',
          '3B görünümde her mekânın kendi ses dokusu vardır; bir tapınak, tiyatro, kapı, pazar ya da kilise seçildiğinde dönemin dilinde kısa bir metin çalar: Helenistik dönemde Yunanca, Roma kentinde Koine Yunancası, Hristiyan kentte Bizans Yunancası. Hierapolis Roma döneminde de Yunanca konuştuğu için kentliler Koine konuşur; Latince, Frontinus Kapısı’ndaki gibi görevliler ve imparatorluk ithafları için kullanılır. Telaffuz yaklaşıktır.')}</p>
        <div className="mt-4 space-y-3">
          {VOICES.map((v) => {
            const places = voicePlaces.filter((l) => Object.values(PLACE_SOUND[l.id].voice ?? {}).includes(v.id))
            return (
              <div key={v.id} className="break-inside-avoid border-b border-ink/10 pb-2 text-[9.5pt]">
                <p className="font-sans text-[7.5pt] uppercase tracking-[0.15em] text-terracotta">{LANG_LABEL[v.lang][lang]} · {places.map((l) => l.name[lang]).join(', ')}</p>
                <p className="italic">{v.text}</p>
                <p className="opacity-75">“{v.gloss[lang]}” — {v.source}</p>
              </div>
            )
          })}
        </div>
      </Page>

      {/* glossary */}
      <Page n={next()} className="p-[16mm]">
        <h2 className="h2">{tr(lang, 'Glossary', 'Sözlük')}</h2>
        <dl className="mt-4 columns-2 gap-8 text-[10pt]">
          {GLOSSARY.map((g) => <div key={g.term} className="mb-3 break-inside-avoid"><dt className="font-display text-terracotta">{g.term}</dt><dd className="leading-snug">{g[lang]}</dd></div>)}
        </dl>
      </Page>

      {/* credits */}
      <Page n={next()} className="p-[16mm]">
        <h2 className="h2">{t('sources')} & {t('credits')}</h2>
        <div className="mt-4 flex items-start gap-8">
          <div className="text-center"><QRCodeSVG value={url} size={120} /><p className="mt-1 font-sans text-[8pt]">{t('scanToOpen')}</p><p className="font-sans text-[8pt] opacity-60">{url.replace(/^https?:\/\//, '')}</p></div>
          <ul className="text-[8.5pt] leading-snug">
            {Array.from(new Map(LANDMARKS.flatMap((l) => l.sources).map((s) => [s.url, s])).values()).map((s) => <li key={s.url}>{s.title} — <span className="opacity-60">{s.url}</span></li>)}
          </ul>
        </div>
        <h3 className="mt-6 font-display text-[12pt]">{t('credits')}</h3>
        <ul className="mt-1 text-[8pt] leading-snug opacity-80">{CREDITS.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="mt-2 text-[8pt] opacity-80">{tr(lang, 'Narration, soundscapes and ancient voices generated with ElevenLabs. Photographs: see captions and research/manifest.csv.', 'Anlatım, ses dokuları ve antik sesler ElevenLabs ile üretildi. Fotoğraflar: alt yazılara ve research/manifest.csv’ye bakınız.')}</p>
        <p className="mt-4 text-[8pt] italic opacity-60">{t('reconstruction')}.</p>
        <div className="mt-3 flex items-center gap-3"><img src="/brand/yasar-university.svg" alt="Yaşar University" className="h-[10mm] w-auto" /><p className="text-[9pt]">{t('author')}</p></div>
      </Page>
    </div>
  )
}
