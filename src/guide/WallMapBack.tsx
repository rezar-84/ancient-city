import type { CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Lang } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { MODERN, TIMELINE } from '../content/timeline'
import type { Landmark } from '../content/types'
import { PALETTE, type Theme } from './MapLayers'
import { eraOf, markerColor } from './mapData'
import { GLOSSARY, NUMBERS } from './printContent'

const tr = (lang: Lang, en: string, t: string) => (lang === 'en' ? en : t)
const thumb = (l: Landmark) => l.renders?.[0] ?? l.paintings?.[0] ?? l.images.find((im) => im.kind !== 'archive')?.src ?? l.images[0]?.src
const dms = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`

/** Resources with a QR code: the app plus the references most worth following up. */
const KEY_LINKS = [
  { url: 'https://whc.unesco.org/en/list/485/', en: 'UNESCO World Heritage: Hierapolis-Pamukkale', tr: 'UNESCO Dünya Mirası: Hierapolis-Pamukkale' },
  { url: 'https://sites.google.com/unisalento.it/scaviricognizioni/hierapolis', en: 'Italian Archaeological Mission (Univ. of Salento)', tr: 'İtalyan Arkeoloji Heyeti (Salento Üniv.)' },
  { url: 'https://journalofromanarchaeology.com/wp-content/uploads/2020/03/JRA31_04_DAndria.pdf', en: 'D’Andria on the Ploutonion (JRA 31, 2018)', tr: 'D’Andria, Plutonion üzerine (JRA 31, 2018)' },
  { url: 'https://en.wikipedia.org/wiki/Hierapolis', en: 'Encyclopedia overview', tr: 'Ansiklopedi özeti' },
]

const Layout = {
  portrait: { fact: 8.8, low: 9.2, gazCols: 4, resH: 66, title: 44 },
  landscape: { fact: 8.6, low: 9.6, gazCols: 6, resH: 0, title: 38 },
}

/** Second A2 sheet: the monuments in detail, full chronology, glossary, research history, method and resources. */
export function WallMapBack({ orient, theme, lang, style }: { orient: 'portrait' | 'landscape'; theme: Theme; lang: Lang; style: CSSProperties }) {
  const t = useT()
  const C = PALETTE[theme]
  const P = Layout[orient]
  const url = window.location.origin
  const card = theme === 'night' ? 'rgba(239,230,212,.05)' : 'rgba(255,255,255,.55)'
  const sources = Array.from(new Map(LANDMARKS.flatMap((l) => l.sources).map((s) => [s.url, s])).values())
  const H3 = ({ children }: { children: string }) => <h3 className="mb-[1.6mm] border-b font-display" style={{ fontSize: '12pt', color: C.gold, borderColor: C.soft }}>{children}</h3>

  const chronology = (
    <section className="min-h-0 overflow-hidden" style={{ gridColumn: 'span 2' }}>
      <H3>{tr(lang, 'Chronology', 'Kronoloji')}</H3>
      <ol className="columns-2 gap-x-[5mm] leading-[1.25]" style={{ fontSize: `${P.low}pt` }}>
        {TIMELINE.map((e) => (
          <li key={e.year + e.label.en} className="mb-[0.9mm] flex break-inside-avoid gap-[1.6mm]">
            <i className="mt-[0.6mm] inline-block shrink-0 rounded-full" style={{ background: eraOf(e.year).color, width: '2mm', height: '2mm' }} />
            <span><b className="font-sans">{formatYear(e.year, lang)}</b> {e.label[lang]}</span>
          </li>
        ))}
      </ol>
    </section>
  )

  const research = (
    <section className="min-h-0 overflow-hidden">
      <H3>{tr(lang, 'Rediscovery & research', 'Yeniden keşif ve araştırma')}</H3>
      <ol className="leading-[1.25]" style={{ fontSize: `${P.low}pt` }}>
        {MODERN.map((e) => <li key={e.year} className="mb-[0.9mm]"><b className="font-sans">{e.year}</b> {e.label[lang]}</li>)}
      </ol>
      <h4 className="mt-[2mm] font-display" style={{ fontSize: '10pt', color: C.gold }}>{tr(lang, 'How this map was made', 'Bu harita nasıl yapıldı')}</h4>
      <p className="leading-[1.25]" style={{ fontSize: `${P.low - 0.2}pt` }}>{tr(lang,
        'The plan is drawn after published excavation plans of the Italian Archaeological Mission and archaeological mapping in OpenStreetMap. Relief and 5 m contours are computed from SRTM elevation data. Positions are real coordinates; the scale bar holds at 100% print size. The 3D monuments are parametric reconstructions built in code from published measurements, an interpretation, not a survey.',
        'Plan, İtalyan Arkeoloji Heyeti’nin yayımlanmış kazı planlarından ve OpenStreetMap’teki arkeolojik haritalamadan çizilmiştir. Rölyef ve 5 m eş yükselti eğrileri SRTM yükselti verisinden hesaplanır. Konumlar gerçek koordinatlardır; ölçek çubuğu %100 baskıda geçerlidir. 3B anıtlar, yayımlanmış ölçülerden kodla kurulan parametrik canlandırmalardır; bir rölöve değil, bir yorumdur.')}</p>
    </section>
  )

  const glossary = (
    <section className="min-h-0 overflow-hidden">
      <H3>{tr(lang, 'Glossary', 'Sözlük')}</H3>
      <dl className="leading-[1.22]" style={{ fontSize: `${P.low - 0.2}pt` }}>
        {GLOSSARY.map((g) => <div key={g.term} className="mb-[0.8mm]"><dt className="inline font-display font-bold" style={{ color: C.soft }}>{g.term}. </dt><dd className="inline">{g[lang]}</dd></div>)}
      </dl>
    </section>
  )

  const visiting = (
    <section className="min-h-0 overflow-hidden">
      <H3>{tr(lang, 'Reading the ruins', 'Kalıntıları okumak')}</H3>
      <ul className="leading-[1.25]" style={{ fontSize: `${P.low - 0.4}pt` }}>
        {[
          tr(lang, 'Walk the plateia from the Frontinus Gate south: the Roman city opens out from its main street.', 'Frontinus Kapısı’ndan güneye plateia boyunca yürüyün: Roma kenti ana caddesinden açılır.'),
          tr(lang, 'Look for re-used blocks in the late walls and gates: they were built quickly from older monuments.', 'Geç dönem sur ve kapılarda yeniden kullanılmış bloklara bakın: eski anıtlardan hızla yapıldılar.'),
          tr(lang, 'Grey travertine is local stone; white marble was brought in for the showpieces.', 'Gri traverten yerel taştır; beyaz mermer gösterişli yapılar için getirilmiştir.'),
          tr(lang, 'Tilted columns and fallen arches are the marks of the earthquakes in the chronology.', 'Eğik sütunlar ve yıkık kemerler kronolojideki depremlerin izleridir.'),
          tr(lang, 'Stay on the paths and walk barefoot on the travertine terraces; leave every stone where it lies.', 'Yollarda kalın ve traverten teraslarda yalınayak yürüyün; her taşı yerinde bırakın.'),
        ].map((s) => <li key={s} className="mb-[1mm] flex gap-[1.4mm]"><span style={{ color: C.gold }}>◆</span><span>{s}</span></li>)}
      </ul>
    </section>
  )

  const resources = (
    <section className="flex min-h-0 gap-[6mm] overflow-hidden">
      <div className="min-w-0 flex-1">
        <H3>{t('sources')}</H3>
        <ul className={(orient === 'portrait' ? 'columns-2' : 'columns-1') + ' gap-x-[5mm] leading-[1.2]'} style={{ fontSize: orient === 'portrait' ? '6.4pt' : '7pt' }}>
          {sources.map((s) => <li key={s.url} className="mb-[0.6mm] break-inside-avoid">{s.title} <span className="opacity-60">{s.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 64)}</span></li>)}
        </ul>
      </div>
      {orient === 'portrait' && (
        <div className="flex shrink-0 gap-[3mm]">
          {KEY_LINKS.map((k) => (
            <figure key={k.url} className="w-[24mm] text-center">
              <span className="inline-block rounded bg-white p-[0.8mm]"><QRCodeSVG value={k.url} size={72} style={{ width: '18mm', height: '18mm' }} /></span>
              <figcaption className="mt-[0.6mm] leading-tight" style={{ fontSize: '5.6pt' }}>{k[lang]}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className="wallmap-sheet poster relative overflow-hidden" style={style}>
      <div className="absolute inset-[12mm] flex flex-col gap-[4mm]">
        {/* header */}
        <header className="flex shrink-0 items-end justify-between gap-[8mm]">
          <div>
            <p className="font-sans uppercase" style={{ fontSize: '9pt', letterSpacing: '0.32em', color: C.gold }}>{t('tagline')} · {tr(lang, 'sheet 2 of 2', 'sayfa 2 / 2')}</p>
            <h1 className="font-display leading-none" style={{ fontSize: `${P.title}pt`, letterSpacing: '0.06em' }}>{tr(lang, 'Hierapolis in depth', 'Ayrıntılarıyla Hierapolis')}</h1>
          </div>
          <div className="flex gap-[5mm]">
            {NUMBERS.slice(0, orient === 'portrait' ? 6 : 8).map((n) => (
              <div key={n.v} className="w-[30mm]">
                <p className="font-display leading-none" style={{ fontSize: '20pt', color: C.gold }}>{n.v}</p>
                <p className="mt-[0.8mm] leading-tight" style={{ fontSize: '7.4pt' }}>{n[lang]}</p>
              </div>
            ))}
          </div>
        </header>

        {/* monument directory */}
        <section className="shrink-0">
          <H3>{tr(lang, 'The monuments, one by one', 'Anıtlar tek tek')}</H3>
          <div className="gap-x-[4mm]" style={{ columnCount: P.gazCols, columnFill: 'balance' }}>
            {LANDMARKS.map((l, i) => {
              const img = thumb(l), col = markerColor(l)
              return (
                <article key={l.id} className="mb-[2.4mm] break-inside-avoid overflow-hidden rounded-[1mm] border-l-[1mm] p-[1.6mm]" style={{ borderColor: col, background: card }}>
                  <header className="flex items-start gap-[1.5mm]">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-sans font-bold text-white" style={{ background: col, width: '5mm', height: '5mm', fontSize: '7.5pt' }}>{i + 1}</span>
                    <div className="min-w-0">
                      <h4 className="font-display leading-tight" style={{ fontSize: orient === 'portrait' ? '12pt' : '11pt' }}>{l.name[lang]}</h4>
                      <p className="font-sans uppercase leading-tight" style={{ fontSize: '5.4pt', letterSpacing: '0.06em', color: col }}>
                        {formatYear(l.built, lang)}{l.until ? `–${formatYear(l.until, lang)}` : ''} · {dms(l.lat, 'N', 'S')} {dms(l.lon, 'E', 'W')}
                      </p>
                    </div>
                  </header>
                  {img && <img src={img} alt="" className="mt-[1.2mm] w-full rounded-[0.6mm] object-cover" style={{ height: orient === 'portrait' ? '34mm' : '30mm' }} />}
                  <p className="mt-[0.8mm] italic leading-tight opacity-80" style={{ fontSize: '6.8pt' }}>{l.period[lang]}</p>
                  <ul className="mt-[0.6mm] leading-[1.22]" style={{ fontSize: `${P.fact}pt` }}>
                    {l.facts[lang].map((f) => <li key={f} className="flex gap-[1mm]"><span style={{ color: col }}>·</span><span>{f}</span></li>)}
                  </ul>
                  {l.didYouKnow && <p className="mt-[0.8mm] leading-[1.22]" style={{ fontSize: `${P.fact - 0.2}pt` }}><b style={{ color: C.gold }}>{tr(lang, 'Did you know?', 'Biliyor muydunuz?')}</b> {l.didYouKnow[lang]}</p>}
                  {l.disputed && <p className="mt-[0.8mm] leading-[1.22] opacity-80" style={{ fontSize: `${P.fact - 0.4}pt` }}>⚑ {l.disputed[lang]}</p>}
                </article>
              )
            })}
          </div>
        </section>

        {/* chronology, research, glossary, reading the ruins */}
        <div className="grid min-h-0 flex-1 gap-x-[6mm]" style={{ gridTemplateColumns: orient === 'portrait' ? 'repeat(4, 1fr)' : 'repeat(6, 1fr)' }}>
          {chronology}
          {research}
          {glossary}
          {orient === 'landscape' && visiting}
          {orient === 'landscape' && resources}
        </div>

        {orient === 'portrait' && (
          <div className="grid min-h-0 shrink-0 gap-x-[6mm]" style={{ height: `${P.resH}mm`, gridTemplateColumns: '1fr 3fr' }}>
            {visiting}
            {resources}
          </div>
        )}

        {/* footer */}
        <footer className="mt-auto flex shrink-0 items-center justify-between gap-[6mm] border-t pt-[2mm] font-sans" style={{ borderColor: C.soft, fontSize: '6.6pt' }}>
          <div className="flex items-center gap-[3mm]">
            <span className="rounded bg-white px-[1.2mm] py-[0.8mm]"><img src="/brand/yasar-university.svg" alt="Yaşar University" style={{ height: '7mm', width: 'auto' }} /></span>
            <span>{t('author')}<br /><span className="opacity-70">{t('reconstruction')}.</span></span>
          </div>
          {orient === 'landscape' && (
            <div className="flex items-center gap-[3mm]">
              {KEY_LINKS.slice(0, 2).map((k) => <span key={k.url} className="flex items-center gap-[1.2mm]"><span className="rounded bg-white p-[0.6mm]"><QRCodeSVG value={k.url} size={64} style={{ width: '11mm', height: '11mm' }} /></span><span className="w-[28mm] leading-tight">{k[lang]}</span></span>)}
            </div>
          )}
          <div className="flex items-center gap-[2.5mm]">
            <span className="text-right">{t('scanToOpen')}<br /><b>{url.replace(/^https?:\/\//, '')}</b></span>
            <span className="rounded bg-white p-[0.8mm]"><QRCodeSVG value={url} size={72} style={{ width: '13mm', height: '13mm' }} /></span>
          </div>
        </footer>
      </div>
    </div>
  )
}
