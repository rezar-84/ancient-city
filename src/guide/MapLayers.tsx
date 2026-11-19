import { useId } from 'react'
import { LANDMARKS } from '../content/landmarks'
import { PLAN } from '../content/plan'
import { RUINS, RUIN_LABELS } from '../content/ruins'
import { TOUR } from '../content/tour'
import { gridLines } from './PlanSVG'
import { markerColor, pathOf, standing, type LL, type Projector } from './mapData'
import type { Lang } from '../store'

export type LayerId = 'underlay' | 'relief' | 'contours' | 'zones' | 'grid' | 'ruins' | 'walls' | 'streets' | 'tour' | 'monuments' | 'labels' | 'graticule'
export type Underlay = 'today' | 'ancient'
export type Theme = 'parchment' | 'night'

export const LAYERS: Array<{ id: LayerId; en: string; tr: string; note: { en: string; tr: string } }> = [
  { id: 'underlay', en: 'Satellite imagery', tr: 'Uydu görüntüsü', note: { en: 'Today’s site, or the same view with modern features painted out', tr: 'Alanın bugünü ya da modern yapıları silinmiş aynı görünüm' } },
  { id: 'relief', en: 'Terrain relief', tr: 'Arazi kabartması', note: { en: 'Hillshade from the elevation model, light from the north-west', tr: 'Yükselti modelinden gölgelendirme, ışık kuzeybatıdan' } },
  { id: 'contours', en: 'Contours', tr: 'Eş yükselti eğrileri', note: { en: 'Every 5 m, bold every 25 m (metres above sea level)', tr: 'Her 5 m’de bir, 25 m’de bir kalın (deniz seviyesinden metre)' } },
  { id: 'zones', en: 'Zones', tr: 'Bölgeler', note: { en: 'Necropoleis, travertine terraces, sanctuary and agora', tr: 'Nekropoller, traverten terasları, kutsal alan ve agora' } },
  { id: 'grid', en: 'Street grid', tr: 'Sokak dokusu', note: { en: 'Hippodamian grid inside the walls (schematic)', tr: 'Surların içindeki Hippodamik ızgara (şematik)' } },
  { id: 'ruins', en: 'Excavated remains', tr: 'Kazılmış kalıntılar', note: { en: 'Building footprints and tombs mapped by OpenStreetMap contributors', tr: 'OpenStreetMap katkıcılarınca haritalanan yapı izleri ve mezarlar' } },
  { id: 'walls', en: 'City walls', tr: 'Kent surları', note: { en: 'Late Roman / Byzantine circuit, late 4th century AD', tr: 'Geç Roma / Bizans suru, MS 4. yüzyıl sonu' } },
  { id: 'streets', en: 'Main streets', tr: 'Ana caddeler', note: { en: 'Colonnaded plateia (c. AD 85) and the roads out of town', tr: 'Sütunlu plateia (MS 85 dolayı) ve kent dışına çıkan yollar' } },
  { id: 'tour', en: 'Guided tour route', tr: 'Rehberli tur güzergâhı', note: { en: 'The stops of the narrated tour in the 3D app', tr: '3B uygulamadaki anlatımlı turun durakları' } },
  { id: 'monuments', en: 'Monuments', tr: 'Anıtlar', note: { en: 'Numbered as in the guide; colour shows the period it was built', tr: 'Rehberdeki gibi numaralı; renk yapım dönemini gösterir' } },
  { id: 'labels', en: 'Place names', tr: 'Yer adları', note: { en: 'Zones and smaller excavated buildings', tr: 'Bölgeler ve daha küçük kazılmış yapılar' } },
  { id: 'graticule', en: 'Coordinates', tr: 'Koordinatlar', note: { en: 'Latitude and longitude (WGS 84)', tr: 'Enlem ve boylam (WGS 84)' } },
]

export const PALETTE = {
  parchment: {
    paper: '#f4ecdc', map: '#efe2c4', ink: '#2b2118', soft: '#6b4a32', line: '#3b281a', street: '#b5653f', wall: '#2b2118',
    sacred: 'rgba(181,101,63,.16)', civic: 'rgba(201,164,92,.22)', hatch: '#7a5a3a', trav: 'rgba(251,247,238,.85)',
    minor: 'rgba(107,74,50,.32)', major: 'rgba(107,74,50,.7)', grid: '#8a6a4a', tour: '#2f6f86', casing: '#fbf8f2', gold: '#9a7a3c',
  },
  night: {
    paper: '#16100b', map: '#1d150f', ink: '#efe6d4', soft: '#c9b28a', line: '#e8d9bd', street: '#e0915a', wall: '#f4efe6',
    sacred: 'rgba(224,145,90,.18)', civic: 'rgba(201,164,92,.2)', hatch: '#c9a45c', trav: 'rgba(244,239,230,.22)',
    minor: 'rgba(232,217,189,.2)', major: 'rgba(232,217,189,.48)', grid: 'rgba(201,164,92,.55)', tour: '#7fc4d6', casing: '#16100b', gold: '#c9a45c',
  },
}

const IMG_BOX = { s: 37.91, n: 37.94, w: 29.105, e: 29.143 } // terrain/meta.json bbox, covered by the satellite images and the relief

const dms = (deg: number) => {
  const d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60)
  return s === 60 ? `${d}°${m + 1}′00″` : `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″`
}

export interface MapProps {
  proj: Projector
  layers: Set<LayerId>
  theme: Theme
  lang: Lang
  underlay?: Underlay
  /** show only what stood in this year (mini maps) */
  year?: number
  highlight?: string | null
  relief?: string | null
  contours?: { minor: string; major: string } | null
  /** stroke / text multiplier; mini maps pass about 0.45 */
  s?: number
  /** leave the map background unpainted (separate layer sheets) */
  transparent?: boolean
}

/** Every data layer of the wall map, drawn in poster millimetres and clipped to the map frame. */
export function MapLayers({ proj, layers, theme, lang, underlay = 'today', year, highlight, relief, contours, s = 1, transparent = false }: MapProps) {
  const uid = useId().replace(/:/g, '')
  const C = PALETTE[theme]
  const on = (id: LayerId) => layers.has(id)
  const { rect } = proj
  const P = (pts: LL[], close = false) => pathOf(proj, pts, close)
  const [ix0, iy0] = proj.p(IMG_BOX.n, IMG_BOX.w), [ix1, iy1] = proj.p(IMG_BOX.s, IMG_BOX.e)
  const imgAttrs = { x: ix0, y: iy0, width: ix1 - ix0, height: iy1 - iy0, preserveAspectRatio: 'none' as const }
  const monuments = LANDMARKS.map((l, i) => ({ l, i })).filter(({ l }) => year === undefined || standing(l, year))
  const wallsUp = year === undefined || year >= PLAN.wallsBuilt
  const streets = PLAN.streets.filter((st) => year === undefined || (st.built ?? -200) <= year)
  const tourPts = TOUR.flatMap((t) => { const l = LANDMARKS.find((x) => x.id === t.landmark); return l ? [[l.lat, l.lon] as LL] : [] })

  return (
    <g>
      <defs>
        <clipPath id={`frame-${uid}`}><rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} /></clipPath>
        <clipPath id={`city-${uid}`}><path d={P(PLAN.walls.flat() as LL[], true)} /></clipPath>
        <pattern id={`hatch-${uid}`} width={1.6 * s} height={1.6 * s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2={1.6 * s} stroke={C.hatch} strokeWidth={0.22 * s} opacity=".6" /></pattern>
        <filter id={`sepia-${uid}`}><feColorMatrix type="matrix" values="0.36 0.62 0.13 0 0  0.32 0.55 0.11 0 0  0.25 0.43 0.09 0 0  0 0 0 1 0" /></filter>
        <filter id={`dim-${uid}`}><feColorMatrix type="matrix" values="0.45 0 0 0 0  0 0.42 0 0 0  0 0 0.38 0 0  0 0 0 1 0" /></filter>
        <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={4} markerHeight={4} orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={C.tour} /></marker>
      </defs>
      <g clipPath={`url(#frame-${uid})`}>
        {!transparent && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={C.map} />}
        {on('underlay') && <image href={underlay === 'ancient' ? '/terrain/sat_ancient.jpg' : '/terrain/sat.jpg'} {...imgAttrs} filter={`url(#${theme === 'night' ? 'dim' : 'sepia'}-${uid})`} opacity={theme === 'night' ? 0.9 : 0.62} />}
        {on('relief') && relief && <image href={relief} {...imgAttrs} opacity={on('underlay') ? 0.55 : 0.9} />}
        {on('contours') && contours && (
          <g fill="none" strokeLinecap="round">
            <path d={contours.minor} stroke={C.minor} strokeWidth={0.13 * s} />
            <path d={contours.major} stroke={C.major} strokeWidth={0.3 * s} />
          </g>
        )}
        {on('zones') && PLAN.zones.map((z) => (
          <path key={z.id} d={P(z.poly, true)} fill={z.kind === 'necropolis' ? `url(#hatch-${uid})` : z.kind === 'travertine' ? C.trav : z.kind === 'sacred' ? C.sacred : C.civic}
            stroke={C.soft} strokeWidth={0.25 * s} strokeDasharray={z.kind === 'necropolis' ? `${1.2 * s} ${0.8 * s}` : undefined} />
        ))}
        {on('grid') && (
          <g clipPath={`url(#city-${uid})`} stroke={C.grid} strokeWidth={0.18 * s} fill="none" opacity={0.85}>
            {gridLines().map((ln, i) => <path key={i} d={P(ln)} />)}
          </g>
        )}
        {on('ruins') && RUINS.map((r, i) => (
          <path key={i} d={P(r.p, r.c)} fill={r.c ? (r.k === 'tomb' ? 'rgba(122,90,58,.4)' : theme === 'night' ? 'rgba(232,217,189,.28)' : 'rgba(90,59,38,.32)') : 'none'}
            stroke={r.k === 'tomb' ? C.hatch : C.line} strokeWidth={(r.k === 'wall' ? 0.5 : 0.16) * s} />
        ))}
        {on('walls') && wallsUp && PLAN.walls.map((w, i) => (
          <g key={i} fill="none" strokeLinejoin="round" strokeLinecap="round">
            <path d={P(w)} stroke={C.casing} strokeWidth={1.5 * s} opacity={0.7} />
            <path d={P(w)} stroke={C.wall} strokeWidth={0.85 * s} />
          </g>
        ))}
        {on('streets') && streets.map((st, i) => (
          <g key={i} fill="none" strokeLinecap="round">
            <path d={P(st.line)} stroke={C.casing} strokeWidth={(st.main ? 1.9 : 1.1) * s} opacity={0.7} />
            <path d={P(st.line)} stroke={C.street} strokeWidth={(st.main ? 1.2 : 0.6) * s} strokeDasharray={st.main ? undefined : `${1.4 * s} ${0.9 * s}`} />
          </g>
        ))}
        {on('tour') && year === undefined && tourPts.slice(1).map((b, i) => {
          const a = tourPts[i], [x0, y0] = proj.p(a[0], a[1]), [x1, y1] = proj.p(b[0], b[1])
          const len = Math.hypot(x1 - x0, y1 - y0), r = 4.5
          if (len < 2 * r) return null
          const ux = (x1 - x0) / len, uy = (y1 - y0) / len
          return <path key={i} d={`M${x0 + ux * r} ${y0 + uy * r}L${x1 - ux * r} ${y1 - uy * r}`} stroke={C.tour} strokeWidth={0.55} strokeDasharray="1.6 1" fill="none" markerEnd={`url(#arrow-${uid})`} />
        })}
        {on('labels') && (
          <g fontFamily='"EB Garamond", Georgia, serif' fill={C.line}>
            {PLAN.zones.filter((z) => z.label).map((z) => {
              const c = z.poly.reduce((a, p) => [a[0] + p[0] / z.poly.length, a[1] + p[1] / z.poly.length], [0, 0])
              const [x, y] = proj.p(c[0], c[1])
              return <text key={z.id} x={x} y={y} fontSize={2.9 * s} textAnchor="middle" fontStyle="italic" letterSpacing={0.5 * s} fill={C.soft} stroke={C.casing} strokeWidth={0.5 * s} paintOrder="stroke">{z.label![lang].toUpperCase()}</text>
            })}
            {s >= 0.8 && RUIN_LABELS.map((l) => { const [x, y] = proj.p(l.lat, l.lon); return <text key={l.en + l.lat} x={x + 1.2} y={y - 0.8} fontSize={2.1} fontStyle="italic" stroke={C.casing} strokeWidth={0.45} paintOrder="stroke">{l[lang]}</text> })}
          </g>
        )}
        {on('monuments') && monuments.map(({ l, i }) => {
          const [x, y] = proj.p(l.lat, l.lon), hot = highlight === l.id, r = (hot ? 3.6 : 2.9) * s
          return (
            <g key={l.id}>
              {hot && <circle cx={x} cy={y} r={r + 2.2} fill="none" stroke={markerColor(l)} strokeWidth={0.8} />}
              <circle cx={x} cy={y} r={r} fill={markerColor(l)} stroke="#fff" strokeWidth={0.45 * s} />
              {s >= 0.6 && <text x={x} y={y + r * 0.38} fontSize={r * 1.05} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="Inter, sans-serif">{i + 1}</text>}
            </g>
          )
        })}
        {on('graticule') && s >= 0.8 && (() => {
          const st = 0.0025, e = proj.edges, out = []
          for (let la = Math.ceil(e.s / st) * st; la < e.n; la += st) for (let lo = Math.ceil(e.w / st) * st; lo < e.e; lo += st) {
            const [x, y] = proj.p(la, lo)
            out.push(<path key={`${la}-${lo}`} d={`M${x - 1.5} ${y}H${x + 1.5}M${x} ${y - 1.5}V${y + 1.5}`} stroke={C.soft} strokeWidth={0.15} />)
          }
          return <g opacity={0.8}>{out}</g>
        })()}
      </g>
      {on('graticule') && s >= 0.8 && (() => {
        const st = 0.0025, e = proj.edges, out = []
        for (let la = Math.ceil(e.s / st) * st; la < e.n; la += st) {
          const [, y] = proj.p(la, e.w)
          out.push(<g key={'la' + la}><path d={`M${rect.x} ${y}h2.5M${rect.x + rect.w} ${y}h-2.5`} stroke={C.ink} strokeWidth={0.25} /><text x={rect.x + 3.2} y={y + 0.8} fontSize={2.1} fill={C.ink} fontFamily="Inter, sans-serif" stroke={C.casing} strokeWidth={0.4} paintOrder="stroke">{dms(la)} N</text></g>)
        }
        for (let lo = Math.ceil(e.w / st) * st; lo < e.e; lo += st) {
          const [x] = proj.p(e.n, lo)
          out.push(<g key={'lo' + lo}><path d={`M${x} ${rect.y}v2.5M${x} ${rect.y + rect.h}v-2.5`} stroke={C.ink} strokeWidth={0.25} /><text x={x} y={rect.y + rect.h - 3.4} fontSize={2.1} fill={C.ink} textAnchor="middle" fontFamily="Inter, sans-serif" stroke={C.casing} strokeWidth={0.4} paintOrder="stroke">{dms(lo)} E</text></g>)
        }
        return <g>{out}</g>
      })()}
    </g>
  )
}

/** North arrow and a scale bar with the printed ratio. */
export function MapFurniture({ proj, theme, lang }: { proj: Projector; theme: Theme; lang: Lang }) {
  const C = PALETTE[theme], { rect, k, denom } = proj
  const m = 200, len = m * k
  const x = rect.x + 6, y = rect.y + rect.h - 12
  return (
    <g fontFamily="Inter, sans-serif" fill={C.ink}>
      <g transform={`translate(${rect.x + rect.w - 12} ${rect.y + 14})`}>
        <circle r={8} fill={C.casing} opacity={0.85} />
        <path d="M0 -6.5L2.6 2.8L0 1.2L-2.6 2.8Z" fill={C.casing} stroke={C.ink} strokeWidth={0.3} /><path d="M0 -6.5L0 1.2L-2.6 2.8Z" fill={C.ink} />
        <text y={6.6} fontSize={2.8} textAnchor="middle" fontWeight={600}>N</text>
      </g>
      <rect x={x - 2.5} y={y - 6} width={len + 22} height={11} rx={1.2} fill={C.casing} opacity={0.85} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={x + (i * len) / 4} y={y} width={len / 4} height={1.4} fill={i % 2 ? C.casing : C.ink} stroke={C.ink} strokeWidth={0.2} />)}
      <text x={x} y={y - 1.2} fontSize={2.2}>0</text>
      <text x={x + len / 2} y={y - 1.2} fontSize={2.2} textAnchor="middle">{m / 2}</text>
      <text x={x + len} y={y - 1.2} fontSize={2.2} textAnchor="middle">{m} m</text>
      <text x={x + len + 4} y={y + 1.4} fontSize={2.2}>1 : {denom.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB')}</text>
      <text x={x} y={y + 4.2} fontSize={1.8} opacity={0.75}>{lang === 'en' ? 'at A2 print size' : 'A2 baskı boyutunda'}</text>
    </g>
  )
}
