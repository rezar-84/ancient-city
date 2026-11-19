import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp, type Lang } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { PLAN_VIEW } from '../content/plan'
import { ERAS, TIMELINE } from '../content/timeline'
import { LangSwitch } from '../ui/TopBar'
import type { Landmark } from '../content/types'
import { LAYERS, MapFurniture, MapLayers, PALETTE, type LayerId, type Theme, type Underlay } from './MapLayers'
import { NATURE, PHRYGIAN, contourPaths, eraOf, hillshadeURL, lead, loadTerrainGrid, makeProjector, markerColor, shortLabel, standing, timeX, type Rect, type TerrainGrid } from './mapData'
import { WallMapBack } from './WallMapBack'
import './print.css'

type Orient = 'portrait' | 'landscape'
type Mode = 'poster' | 'sheets'
const tr = (lang: Lang, en: string, t: string) => (lang === 'en' ? en : t)

const BOUNDS = { s: PLAN_VIEW.s, n: PLAN_VIEW.n, w: PLAN_VIEW.w, e: PLAN_VIEW.e }
/** satellite and terrain coverage (terrain/meta.json): the frame is kept inside it */
const IMAGERY = { s: 37.91, n: 37.94, w: 29.105, e: 29.143 }
const MM = 96 / 25.4 // CSS px per mm

interface Layout {
  W: number; H: number
  header: Rect; map: Rect; left: Rect; right: Rect; leftCount: number
  timeline: Rect; legend: Rect; time: Rect & { cols: number }; historic?: Rect; footerY: number
  pt: { title: number; name: number; body: number }
}

const LAYOUTS: Record<Orient, Layout> = {
  portrait: {
    W: 420, H: 594,
    header: { x: 12, y: 12, w: 396, h: 46 },
    left: { x: 12, y: 66, w: 72, h: 352 }, map: { x: 92, y: 66, w: 236, h: 352 }, right: { x: 336, y: 66, w: 72, h: 352 }, leftCount: 9,
    timeline: { x: 12, y: 424, w: 396, h: 40 },
    legend: { x: 12, y: 468, w: 124, h: 98 }, time: { x: 142, y: 468, w: 170, h: 98, cols: 4 }, historic: { x: 318, y: 468, w: 90, h: 98 },
    footerY: 572,
    pt: { title: 64, name: 9.5, body: 7.8 },
  },
  landscape: {
    W: 594, H: 420,
    header: { x: 12, y: 10, w: 570, h: 38 },
    left: { x: 12, y: 54, w: 104, h: 300 }, map: { x: 122, y: 54, w: 256, h: 300 }, right: { x: 384, y: 54, w: 104, h: 300 }, leftCount: 9,
    timeline: { x: 12, y: 358, w: 570, h: 38 },
    legend: { x: 496, y: 54, w: 86, h: 128 }, time: { x: 496, y: 188, w: 86, h: 166, cols: 2 },
    footerY: 400,
    pt: { title: 54, name: 9, body: 7.6 },
  },
}

const PHASES: Array<{ year: number; en: string; tr: string }> = [
  { year: -150, en: 'Hellenistic city: the Sanctuary of Apollo and the Ploutonion beside the springs; tombs along the road north.', tr: 'Helenistik kent: kaynakların yanında Apollon Kutsal Alanı ve Plutonion; kuzey yolu boyunca mezarlar.' },
  { year: 200, en: 'Roman city rebuilt after the AD 60 earthquake: Frontinus Gate and colonnaded street, theatre, agora and baths.', tr: 'MS 60 depreminden sonra yeniden kurulan Roma kenti: Frontinus Kapısı ve sütunlu cadde, tiyatro, agora ve hamamlar.' },
  { year: 500, en: 'Christian city inside the late 4th-century walls: Martyrium of St Philip and the cathedral; the Ploutonion is closed.', tr: '4. yüzyıl sonu surları içinde Hristiyan kent: Aziz Philippos Martyrionu ve katedral; Plutonion kapatılmıştır.' },
  { year: 1300, en: 'Seljuk-era town, smaller and fortified; abandoned after a 14th-century earthquake (1334 or 1354).', tr: 'Selçuklu dönemi kenti, küçülmüş ve tahkimli; 14. yüzyıl depreminden (1334 ya da 1354) sonra terk edilir.' },
]

const HISTORIC = [
  { src: '/img/plan_1.jpg', en: 'Léon de Laborde, plan of 1838', tr: 'Léon de Laborde, 1838 planı' },
  { src: '/img/plan_7.jpg', en: 'Carl Humann, survey of 1887', tr: 'Carl Humann, 1887 araştırması' },
]

const DEFAULT_LAYERS: LayerId[] = ['underlay', 'relief', 'contours', 'zones', 'ruins', 'walls', 'streets', 'tour', 'monuments', 'labels', 'graticule']

const cardImage = (l: Landmark) => l.renders?.[0] ?? l.paintings?.[0] ?? l.images.find((im) => im.kind !== 'archive')?.src ?? l.images[0]?.src

/** Callouts around the map: west half on the left, east half on the right, each column in north-to-south order. */
function placeCards(L: Layout, proj: ReturnType<typeof makeProjector>) {
  const pts = LANDMARKS.map((l, i) => ({ l, i, pt: proj.p(l.lat, l.lon) }))
  const byX = [...pts].sort((a, b) => a.pt[0] - b.pt[0])
  const cols = [
    { side: 'left' as const, r: L.left, items: byX.slice(0, L.leftCount) },
    { side: 'right' as const, r: L.right, items: byX.slice(L.leftCount) },
  ]
  const gap = 3
  return cols.flatMap(({ side, r, items }) => {
    items.sort((a, b) => a.pt[1] - b.pt[1])
    const h = (r.h - gap * (items.length - 1)) / items.length
    return items.map((it, k) => ({ ...it, side, box: { x: r.x, y: r.y + k * (h + gap), w: r.w, h } }))
  })
}

export function useTerrain() {
  const [t, setT] = useState<TerrainGrid | null>(null)
  useEffect(() => { let live = true; loadTerrainGrid().then((g) => live && setT(g)).catch(() => {}); return () => { live = false } }, [])
  return t
}

/** A2 wall map (#/wallmap): layered archaeological map with callouts, timeline and the city through time. */
export default function WallMap() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [orient, setOrient] = useState<Orient>('portrait')
  const [theme, setTheme] = useState<Theme>('parchment')
  const [underlay, setUnderlay] = useState<Underlay>('ancient')
  const [mode, setMode] = useState<Mode>('poster')
  const [layers, setLayers] = useState<Set<LayerId>>(() => new Set(DEFAULT_LAYERS))
  const [hot, setHot] = useState<string | null>(null)
  const [back, setBack] = useState(true)
  const [fit, setFit] = useState(1)
  const terrain = useTerrain()
  const L = LAYOUTS[orient]
  const C = PALETTE[theme]
  const url = window.location.origin

  useEffect(() => {
    const st = document.createElement('style')
    st.textContent = `@page { size: A2 ${orient}; margin: 0; }`
    document.head.appendChild(st)
    document.body.classList.add('printing')
    return () => { st.remove(); document.body.classList.remove('printing') }
  }, [orient])

  useEffect(() => {
    const on = () => setFit(Math.min(1, (window.innerWidth - 32) / (L.W * MM)))
    on(); window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [L.W])

  const proj = useMemo(() => makeProjector(BOUNDS, L.map, 250, IMAGERY), [L])
  const relief = useMemo(() => (terrain ? hillshadeURL(terrain, theme === 'night') : null), [terrain, theme])
  const contours = useMemo(() => (terrain ? contourPaths(terrain, proj) : null), [terrain, proj])
  const cards = useMemo(() => placeCards(L, proj), [L, proj])
  const toggle = (id: LayerId) => setLayers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const active = LAYERS.filter((x) => layers.has(x.id))

  const sheetStyle: CSSProperties = { width: `${L.W}mm`, height: `${L.H}mm`, background: C.paper, color: C.ink, ['--fit' as string]: fit }
  const mm = (r: Rect): CSSProperties => ({ position: 'absolute', left: `${r.x}mm`, top: `${r.y}mm`, width: `${r.w}mm`, height: `${r.h}mm` })

  return (
    <div className="poster-wrap font-serif">
      <div className="no-print sticky top-0 z-10 flex flex-col gap-2 bg-ink px-4 py-3 text-travertine">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <a href="#/" className="btn-ghost">← Hierapolis 3D</a>
            <a href="#/guide" className="btn-ghost">⎙ {t('guide')}</a>
            <a href="#/poster" className="btn-ghost">▭ {tr(lang, 'Posters', 'Posterler')}</a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Seg value={orient} set={setOrient} opts={[['portrait', tr(lang, 'A2 portrait', 'A2 dikey')], ['landscape', tr(lang, 'A2 landscape', 'A2 yatay')]]} />
            <Seg value={theme} set={setTheme} opts={[['parchment', tr(lang, 'Parchment', 'Parşömen')], ['night', tr(lang, 'Night (wallpaper)', 'Gece (duvar kâğıdı)')]]} />
            <Seg value={underlay} set={setUnderlay} opts={[['ancient', tr(lang, 'Landscape', 'Arazi')], ['today', tr(lang, 'Today', 'Bugün')]]} />
            <Seg value={mode} set={setMode} opts={[['poster', tr(lang, 'Poster', 'Poster')], ['sheets', tr(lang, 'One sheet per layer', 'Her katman ayrı sayfa')]]} />
            {mode === 'poster' && <button aria-pressed={back} className={back ? 'btn-active' : 'btn-ghost'} onClick={() => setBack((b) => !b)} title={tr(lang, 'Second sheet: monuments in detail, chronology, glossary and resources', 'İkinci sayfa: ayrıntılı anıtlar, kronoloji, sözlük ve kaynaklar')}>{tr(lang, '+ Sheet 2: details', '+ Sayfa 2: ayrıntılar')}</button>}
            <LangSwitch />
            <button className="btn-gold" onClick={() => window.print()} disabled={!terrain}>⎙ PDF</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label={tr(lang, 'Map layers', 'Harita katmanları')}>
          <span className="mr-1 opacity-60">{tr(lang, 'Layers', 'Katmanlar')}:</span>
          {LAYERS.map((x) => (
            <button key={x.id} aria-pressed={layers.has(x.id)} title={x.note[lang]} onClick={() => toggle(x.id)}
              className={'rounded-full border px-2.5 py-1 ' + (layers.has(x.id) ? 'border-gold bg-gold/80 text-ink' : 'border-white/25 text-travertine/70')}>
              {x[lang]}
            </button>
          ))}
          {!terrain && <span className="ml-2 opacity-60">{tr(lang, 'Preparing terrain…', 'Arazi hazırlanıyor…')}</span>}
        </div>
      </div>

      {mode === 'poster' && (
        <div className="wallmap-sheet poster relative overflow-hidden" style={sheetStyle}>
          {/* header */}
          <div style={mm(L.header)} className="flex items-end justify-between gap-[8mm]">
            <div className="min-w-0">
              <p className="font-sans uppercase" style={{ fontSize: '9pt', letterSpacing: '0.32em', color: C.gold }}>{t('tagline')}</p>
              <h1 className="font-display leading-none" style={{ fontSize: `${L.pt.title}pt`, letterSpacing: '0.08em' }}>HIERAPOLIS</h1>
              <p className="italic" style={{ fontSize: '17pt' }}>{tr(lang, 'Archaeological map of the Holy City above Pamukkale', 'Pamukkale üzerindeki Kutsal Kentin arkeolojik haritası')}</p>
            </div>
            <p className="max-w-[150mm] shrink leading-snug" style={{ fontSize: '9.5pt' }}>{tr(lang,
              'A Hellenistic city founded beside hot springs in the 2nd century BC, rebuilt in marble after the earthquake of AD 60, and a centre of Christian pilgrimage to the tomb of the Apostle Philip until it was abandoned in the 14th century. Each number on the map points to a monument rebuilt in the 3D app; the small maps below show what stood in four moments of its history.',
              'MÖ 2. yüzyılda sıcak su kaynaklarının yanında kurulan, MS 60 depreminden sonra mermerle yeniden inşa edilen ve 14. yüzyılda terk edilene dek Havari Philippos’un mezarına giden Hristiyan hacıların merkezi olan Helenistik bir kent. Haritadaki her numara 3B uygulamada yeniden kurulan bir anıtı gösterir; alttaki küçük haritalar tarihinin dört anında ayakta olanları gösterir.')}</p>
          </div>

          {/* map + leader lines + timeline */}
          <svg className="absolute inset-0" width={`${L.W}mm`} height={`${L.H}mm`} viewBox={`0 0 ${L.W} ${L.H}`}>
            <MapLayers proj={proj} layers={layers} theme={theme} lang={lang} underlay={underlay} highlight={hot} relief={relief} contours={contours} />
            <rect x={L.map.x} y={L.map.y} width={L.map.w} height={L.map.h} fill="none" stroke={C.ink} strokeWidth={0.6} />
            <rect x={L.map.x - 1.2} y={L.map.y - 1.2} width={L.map.w + 2.4} height={L.map.h + 2.4} fill="none" stroke={C.ink} strokeWidth={0.2} />
            <MapFurniture proj={proj} theme={theme} lang={lang} />
            {layers.has('monuments') && cards.map(({ l, side, box, pt }) => {
              const ay = box.y + box.h / 2, ax = side === 'left' ? box.x + box.w : box.x
              const ex = side === 'left' ? L.map.x : L.map.x + L.map.w
              const dx = pt[0] - ex, dy = pt[1] - ay, len = Math.hypot(dx, dy), r = 3.6
              const tx = pt[0] - (dx / len) * r, ty = pt[1] - (dy / len) * r
              const d = `M${ax} ${ay}H${ex}L${tx} ${ty}`
              const isHot = hot === l.id
              return (
                <g key={l.id} fill="none" strokeLinejoin="round" opacity={hot && !isHot ? 0.35 : 1}>
                  <path d={d} stroke={C.casing} strokeWidth={isHot ? 1.3 : 0.8} opacity={0.85} />
                  <path d={d} stroke={markerColor(l)} strokeWidth={isHot ? 0.6 : 0.3} />
                  <circle cx={ax} cy={ay} r={0.8} fill={markerColor(l)} />
                </g>
              )
            })}
            <Timeline r={L.timeline} theme={theme} lang={lang} />
          </svg>

          {/* callouts */}
          {cards.map(({ l, i, box }) => {
            const img = cardImage(l)
            return (
              <article key={l.id} style={{ ...mm(box), borderColor: markerColor(l), background: theme === 'night' ? 'rgba(239,230,212,.05)' : 'rgba(255,255,255,.55)' }}
                className="flex flex-col overflow-hidden rounded-[1.2mm] border-l-[1.2mm] p-[1.6mm] pl-[2mm]"
                onMouseEnter={() => setHot(l.id)} onMouseLeave={() => setHot(null)}>
                <header className="flex items-baseline gap-[1.5mm]">
                  <span className="inline-flex shrink-0 items-center justify-center rounded-full font-sans font-bold text-white" style={{ background: markerColor(l), width: '5mm', height: '5mm', fontSize: '7.5pt' }}>{i + 1}</span>
                  <h2 className="truncate font-display leading-tight" style={{ fontSize: `${L.pt.name}pt` }}>{l.name[lang]}</h2>
                </header>
                <div className="mt-[1.2mm] flex min-h-0 flex-1 gap-[2mm]">
                  {img && <img src={img} alt="" className="h-full shrink-0 rounded-[0.8mm] object-cover" style={{ width: '38%' }} />}
                  <div className="min-w-0 flex-1 overflow-hidden leading-[1.22]" style={{ fontSize: `${L.pt.body}pt` }}>
                    <p className="font-sans uppercase" style={{ fontSize: '5.6pt', letterSpacing: '0.08em', color: markerColor(l) }}>{l.period[lang]} · {formatYear(l.built, lang)}{l.until ? `–${formatYear(l.until, lang)}` : ''}</p>
                    <p className="mt-[0.5mm]">{lead(l.summary[lang], orient === 'portrait' ? 240 : 260)}</p>
                  </div>
                </div>
              </article>
            )
          })}

          {/* legend */}
          <div style={mm(L.legend)} className="overflow-hidden">
            <h3 className="font-display" style={{ fontSize: '11pt', color: C.gold }}>{tr(lang, 'Map layers', 'Harita katmanları')}</h3>
            <ul className={'mt-[1.5mm] gap-x-[4mm] ' + (orient === 'portrait' ? 'columns-2' : '')} style={{ fontSize: '6.6pt' }}>
              {active.map((x) => (
                <li key={x.id} className="mb-[1.4mm] flex break-inside-avoid gap-[1.6mm] leading-tight">
                  <Swatch id={x.id} theme={theme} />
                  <span><b>{x[lang]}</b><br /><span className="opacity-75">{x.note[lang]}</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-[1mm] flex flex-wrap gap-x-[2.5mm] gap-y-[1mm]" style={{ fontSize: '6.4pt' }}>
              {[PHRYGIAN, ...ERAS].map((e) => <span key={e.id} className="inline-flex items-center gap-[1mm]"><i className="inline-block rounded-full" style={{ background: e.color, width: '2.6mm', height: '2.6mm' }} />{e.label[lang]}</span>)}
              <span className="inline-flex items-center gap-[1mm]"><i className="inline-block rounded-full" style={{ background: NATURE.color, width: '2.6mm', height: '2.6mm' }} />{NATURE.label[lang]}</span>
            </div>
          </div>

          {/* the city through time */}
          <div style={mm(L.time)}>
            <h3 className="font-display" style={{ fontSize: '11pt', color: C.gold }}>{tr(lang, 'The city through time', 'Zaman içinde kent')}</h3>
            <PhaseMaps r={{ ...L.time, y: 7, x: 0 }} cols={L.time.cols} theme={theme} lang={lang} relief={relief} />
          </div>

          {/* historic maps */}
          {L.historic && (
            <div style={mm(L.historic)}>
              <h3 className="font-display" style={{ fontSize: '11pt', color: C.gold }}>{tr(lang, 'Mapped by travellers', 'Gezginlerin haritaları')}</h3>
              <div className="mt-[1.5mm] grid grid-cols-2 gap-[2.5mm]">
                {HISTORIC.map((h) => (
                  <figure key={h.src}>
                    <img src={h.src} alt="" className="w-full rounded-[0.8mm] bg-white object-contain" style={{ height: '70mm' }} />
                    <figcaption className="mt-[0.8mm] leading-tight" style={{ fontSize: '6.4pt' }}>{h[lang]}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* footer */}
          <footer className="absolute flex items-center justify-between gap-[6mm] border-t pt-[2mm] font-sans" style={{ left: '12mm', right: '12mm', top: `${L.footerY}mm`, borderColor: C.soft, fontSize: '6.6pt' }}>
            <div className="flex items-center gap-[3mm]">
              <span className="rounded bg-white px-[1.2mm] py-[0.8mm]"><img src="/brand/yasar-university.svg" alt="Yaşar University" style={{ height: '7mm', width: 'auto' }} /></span>
              <span>{t('author')}<br /><span className="opacity-70">{t('reconstruction')}. {tr(lang, 'Plan schematic, after MAIER excavation plans.', 'Plan şematiktir, MAIER kazı planlarından.')}</span></span>
            </div>
            <span className="max-w-[150mm] text-center opacity-70">{tr(lang, 'Plan data © OpenStreetMap contributors (ODbL) · Elevation: Mapzen terrain tiles (SRTM) · Imagery © Esri, Maxar, Earthstar Geographics', 'Plan verisi © OpenStreetMap katkıcıları (ODbL) · Yükselti: Mapzen arazi karoları (SRTM) · Görüntü © Esri, Maxar, Earthstar Geographics')}</span>
            <div className="flex items-center gap-[2.5mm]">
              <span className="text-right">{t('scanToOpen')}<br /><b>{url.replace(/^https?:\/\//, '')}</b></span>
              <span className="rounded bg-white p-[0.8mm]"><QRCodeSVG value={url} size={72} style={{ width: '13mm', height: '13mm' }} /></span>
            </div>
          </footer>
        </div>
      )}

      {mode === 'poster' && back && <WallMapBack orient={orient} theme={theme} lang={lang} style={sheetStyle} />}

      {mode === 'sheets' && active.map((x, n) => (
        <div key={x.id} className="wallmap-sheet poster relative overflow-hidden" style={{ ...sheetStyle, background: '#fff', color: '#2b2118' }}>
          <div className="absolute font-sans" style={{ left: `${L.map.x}mm`, top: `${L.map.y - 22}mm`, fontSize: '9pt' }}>
            <p className="uppercase" style={{ letterSpacing: '0.25em', color: '#9a7a3c' }}>Hierapolis · {tr(lang, 'layer', 'katman')} {n + 1} / {active.length}</p>
            <p className="font-display" style={{ fontSize: '22pt' }}>{x[lang]}</p>
            <p className="opacity-70">{x.note[lang]}</p>
          </div>
          <svg className="absolute inset-0" width={`${L.W}mm`} height={`${L.H}mm`} viewBox={`0 0 ${L.W} ${L.H}`}>
            <MapLayers proj={proj} layers={new Set([x.id])} theme="parchment" lang={lang} underlay={underlay} relief={relief} contours={contours} transparent />
            <rect x={L.map.x} y={L.map.y} width={L.map.w} height={L.map.h} fill="none" stroke="#2b2118" strokeWidth={0.25} strokeDasharray="2 2" />
            <Registration r={L.map} />
          </svg>
          <p className="absolute font-sans opacity-60" style={{ left: `${L.map.x}mm`, top: `${L.map.y + L.map.h + 8}mm`, fontSize: '7pt' }}>
            {tr(lang, 'Print every sheet at 100% and line up the registration marks to stack the layers.', 'Katmanları üst üste getirmek için her sayfayı %100 basın ve hizalama işaretlerini çakıştırın.')} 1 : {proj.denom.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB')}
          </p>
        </div>
      ))}
    </div>
  )
}

function Seg<T extends string>({ value, set, opts }: { value: T; set: (v: T) => void; opts: Array<[T, string]> }) {
  return (
    <div className="flex rounded-full border border-white/20 p-0.5">
      {opts.map(([v, label]) => <button key={v} aria-pressed={value === v} className={'rounded-full px-2.5 py-1 ' + (value === v ? 'bg-travertine text-ink' : 'text-travertine/80')} onClick={() => set(v)}>{label}</button>)}
    </div>
  )
}

/** Crosshair registration marks just outside each corner of the map frame. */
function Registration({ r }: { r: Rect }) {
  const pts: Array<[number, number]> = [[r.x - 8, r.y - 8], [r.x + r.w + 8, r.y - 8], [r.x - 8, r.y + r.h + 8], [r.x + r.w + 8, r.y + r.h + 8]]
  return <g stroke="#000" strokeWidth={0.2} fill="none">{pts.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r={3} /><path d={`M${x - 5} ${y}H${x + 5}M${x} ${y - 5}V${y + 5}`} /></g>)}</g>
}

/** Legend symbol for one layer. */
function Swatch({ id, theme }: { id: LayerId; theme: Theme }) {
  const C = PALETTE[theme]
  const body = (() => {
    switch (id) {
      case 'underlay': return <rect x="0.5" y="0.5" width="7" height="5" fill="#8f8a70" stroke={C.soft} strokeWidth="0.3" />
      case 'relief': return <><rect x="0.5" y="0.5" width="7" height="5" fill={C.map} /><path d="M0.5 5.5L3 2L5 4L7.5 1.5V5.5Z" fill="rgba(43,33,24,.45)" /></>
      case 'contours': return <path d="M0.5 4.8C2 3.6 3.5 4.4 7.5 3M0.5 2.8C2.4 1.6 4 2.4 7.5 1" stroke={C.major} strokeWidth="0.35" fill="none" />
      case 'zones': return <rect x="0.5" y="0.5" width="7" height="5" fill={C.sacred} stroke={C.soft} strokeWidth="0.3" strokeDasharray="1 0.6" />
      case 'grid': return <path d="M0.5 2H7.5M0.5 4H7.5M2.5 0.5V5.5M5 0.5V5.5" stroke={C.grid} strokeWidth="0.25" />
      case 'ruins': return <rect x="1.5" y="1.2" width="5" height="3.6" fill="rgba(90,59,38,.32)" stroke={C.line} strokeWidth="0.25" />
      case 'walls': return <path d="M0.5 4L3 2.4L7.5 2.8" stroke={C.wall} strokeWidth="0.85" fill="none" />
      case 'streets': return <path d="M0.5 4.5L7.5 1.5" stroke={C.street} strokeWidth="1.1" />
      case 'tour': return <path d="M0.5 4.5L6.5 1.8" stroke={C.tour} strokeWidth="0.55" strokeDasharray="1.4 0.9" />
      case 'monuments': return <><circle cx="4" cy="3" r="2.4" fill="#b5653f" stroke="#fff" strokeWidth="0.35" /><text x="4" y="4" fontSize="2.6" fill="#fff" textAnchor="middle" fontWeight="700" fontFamily="Inter, sans-serif">1</text></>
      case 'labels': return <text x="4" y="4" fontSize="3.6" textAnchor="middle" fontStyle="italic" fill={C.soft} fontFamily="Georgia, serif">Aa</text>
      case 'graticule': return <path d="M4 1V5M2 3H6" stroke={C.soft} strokeWidth="0.3" />
    }
  })()
  return <svg viewBox="0 0 8 6" className="shrink-0" style={{ width: '6.5mm', height: '4.9mm' }}>{body}</svg>
}

/** Small maps: monuments standing or in use at four dates. */
export function PhaseMaps({ r, cols, theme, lang, relief }: { r: Rect; cols: number; theme: Theme; lang: Lang; relief: string | null }) {
  const C = PALETTE[theme]
  const rows = Math.ceil(PHASES.length / cols), gap = 3
  const cw = (r.w - gap * (cols - 1)) / cols, ch = (r.h - r.y - gap * (rows - 1)) / rows
  const capH = cols >= 4 ? 25 : 22
  const mapH = ch - capH
  const layers = new Set<LayerId>(['relief', 'zones', 'walls', 'streets', 'monuments'])
  return (
    <div className="absolute" style={{ left: 0, top: `${r.y}mm`, width: `${r.w}mm` }}>
      {PHASES.map((ph, i) => {
        const col = i % cols, row = Math.floor(i / cols)
        const box = { x: 0, y: 0, w: cw, h: mapH }
        const proj = makeProjector(BOUNDS, box, 500, IMAGERY)
        const era = eraOf(ph.year)
        const n = LANDMARKS.filter((l) => standing(l, ph.year)).length
        return (
          <figure key={ph.year} className="absolute" style={{ left: `${col * (cw + gap)}mm`, top: `${row * (ch + gap)}mm`, width: `${cw}mm` }}>
            <svg width={`${cw}mm`} height={`${mapH}mm`} viewBox={`0 0 ${cw} ${mapH}`} className="block rounded-[0.8mm]" style={{ outline: `0.3mm solid ${era.color}` }}>
              <MapLayers proj={proj} layers={layers} theme={theme} lang={lang} year={ph.year} relief={relief} s={Math.min(1, Math.max(0.42, cw / 100))} />
            </svg>
            <figcaption className="mt-[1mm] leading-[1.18]" style={{ fontSize: '6.2pt' }}>
              <b className="font-display" style={{ color: era.color, fontSize: '8pt' }}>{formatYear(ph.year, lang).replace(/^(\d+) BC$/, 'c. $1 BC')}</b>
              <span className="font-sans opacity-70" style={{ fontSize: '5.4pt' }}> · {era.label[lang]} · {n} {tr(lang, 'on the map', 'haritada')}</span><br />
              <span style={{ color: C.ink }}>{ph[lang]}</span>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

/** Era bands and dated events on a stretched time axis. */
function Timeline({ r, theme, lang }: { r: Rect; theme: Theme; lang: Lang }) {
  const C = PALETTE[theme]
  const X = (y: number) => r.x + timeX(y) * r.w
  const bandY = r.y + 4, bandH = 3.4
  const bands = [PHRYGIAN, ...ERAS].map((e) => ({ ...e, from: e.id === 'phrygian' ? -700 : e.from, to: e.id === 'seljuk' ? 1400 : e.to }))
  const rowsY = [0, 1, 2, 3].map((k) => bandY + bandH + 3 + k * 8)
  // greedy rows: each label goes to the first row that is free at its x position
  const ends = rowsY.map(() => -Infinity)
  const placed = TIMELINE.map((e) => {
    const x = X(e.year), lines = wrap(shortLabel(e.label[lang]), 25, 2)
    const w = Math.max(6, ...lines.map((l) => l.length)) * 0.98 + 1.5
    let row = ends.findIndex((end) => end < x)
    if (row < 0) row = ends.indexOf(Math.min(...ends))
    const lx = Math.min(x - 0.4, r.x + r.w - w)
    ends[row] = lx + w
    return { e, x, lx, y: rowsY[row], lines }
  })
  return (
    <g fontFamily='"EB Garamond", Georgia, serif'>
      <text x={r.x} y={r.y + 1.6} fontSize={3.6} fill={C.gold} fontFamily="Cinzel, Georgia, serif">{tr(lang, 'Timeline', 'Zaman çizelgesi')}</text>
      {bands.map((b) => (
        <g key={b.id}>
          <rect x={X(b.from)} y={bandY} width={X(b.to) - X(b.from)} height={bandH} fill={b.color} />
          <text x={X(b.from) + 1} y={bandY + bandH - 0.9} fontSize={2.2} fill="#fff" fontFamily="Inter, sans-serif">{b.label[lang]}</text>
        </g>
      ))}
      {placed.map(({ e, x, lx, y, lines }) => {
        return (
          <g key={e.year + e.label.en}>
            <path d={`M${x} ${bandY + bandH}V${y + 0.4}`} stroke={C.soft} strokeWidth={0.15} />
            <circle cx={x} cy={bandY + bandH / 2} r={0.7} fill="#fff" stroke={C.ink} strokeWidth={0.2} />
            <text x={lx} y={y} fontSize={2.15} fill={C.ink}>
              <tspan fontFamily="Inter, sans-serif" fontSize={1.85} fontWeight={600} fill={C.street}>{formatYear(e.year, lang)}</tspan>
              {lines.map((ln, k) => <tspan key={k} x={lx} dy={2.5}>{ln}</tspan>)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Greedy word wrap into lines of at most `n` characters. */
function wrap(s: string, n: number, max = 3) {
  const out: string[] = []
  for (const w of s.split(' ')) {
    const last = out[out.length - 1]
    if (last !== undefined && (last + ' ' + w).length <= n) out[out.length - 1] = last + ' ' + w
    else out.push(w)
  }
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/[,.…]*$/, '…') }
  return out
}
