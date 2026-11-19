import { LANDMARKS } from '../content/landmarks'
import { PLAN, PLAN_VIEW } from '../content/plan'
import { RUINS, RUIN_LABELS } from '../content/ruins'
import type { Lang } from '../store'
import { GRID } from '../content/grid'

/** Static archaeological plan (for print), drawn from the same data as the 3D scene. */
/** Hippodamian grid lines (lat/lon polylines) for the plan, same parameters as the 3D whole-city layer. */
export function gridLines(): Array<[number, number][]> {
  const lat0 = GRID.axisFrom[0], mLat = 111320, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const toM = ([la, lo]: [number, number]) => [(lo - GRID.axisFrom[1]) * mLon, -(la - lat0) * mLat]
  const toLL = (x: number, z: number): [number, number] => [lat0 - z / mLat, GRID.axisFrom[1] + x / mLon]
  const [bx, bz] = toM(GRID.axisTo), L = Math.hypot(bx, bz), u = [bx / L, bz / L], v = [u[1], -u[0]]
  const P = (pu: number, pv: number) => toLL(u[0] * pu + v[0] * pv, u[1] * pu + v[1] * pv)
  const vMin = -(GRID.mainHalf + GRID.blocksWest * GRID.pitchV), vMax = GRID.mainHalf + GRID.blocksEast * GRID.pitchV
  const out: Array<[number, number][]> = []
  for (let k = 0; k * GRID.pitchU <= L; k++) out.push([P(k * GRID.pitchU, vMin), P(k * GRID.pitchU, vMax)])
  for (const side of [1, -1]) {
    const n = side > 0 ? GRID.blocksEast : GRID.blocksWest
    for (let m = 1; m <= n; m++) { const pv = side * (GRID.mainHalf + m * GRID.pitchV - GRID.plateiaW / 2); out.push([P(0, pv), P(L, pv)]) }
  }
  return out
}

export function PlanSVG({ lang, width = 700, withLabels = true, highlight, grid = false, fit = false }: { lang: Lang; width?: number; withLabels?: boolean; highlight?: string; grid?: boolean; fit?: boolean }) {
  const { s, n, w, e } = PLAN_VIEW
  const kx = Math.cos(((s + n) / 2) * Math.PI / 180)
  const aspect = (n - s) / ((e - w) * kx)
  const W = width, H = width * aspect
  const px = (lat: number, lon: number): [number, number] => [((lon - w) / (e - w)) * W, ((n - lat) / (n - s)) * H]
  const path = (pts: Array<[number, number]>, close = false) =>
    pts.map(([la, lo], i) => (i ? 'L' : 'M') + px(la, lo).map((v) => v.toFixed(1)).join(' ')).join(' ') + (close ? ' Z' : '')
  const scaleM = 200
  const scalePx = (scaleM / ((e - w) * 111320 * kx)) * W
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={fit ? '100%' : undefined} style={{ background: '#efe2c4', fontFamily: '"EB Garamond", Georgia, serif' }}>
      <defs>
        <filter id="sepia"><feColorMatrix type="matrix" values="0.36 0.62 0.13 0 0  0.32 0.55 0.11 0 0  0.25 0.43 0.09 0 0  0 0 0 0.55 0" /></filter>
        <clipPath id="city-clip"><path d={path(PLAN.walls.flat() as Array<[number, number]>, true)} /></clipPath>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#8a6a4a" strokeWidth="1" opacity=".45" /></pattern>
      </defs>
      <image href={PLAN_VIEW.underlay} x={PLAN_VIEW.imgBox ? px(PLAN_VIEW.imgBox.n, PLAN_VIEW.imgBox.w)[0] : 0} y={PLAN_VIEW.imgBox ? px(PLAN_VIEW.imgBox.n, PLAN_VIEW.imgBox.w)[1] : 0}
        width={PLAN_VIEW.imgBox ? px(PLAN_VIEW.imgBox.s, PLAN_VIEW.imgBox.e)[0] - px(PLAN_VIEW.imgBox.n, PLAN_VIEW.imgBox.w)[0] : W}
        height={PLAN_VIEW.imgBox ? px(PLAN_VIEW.imgBox.s, PLAN_VIEW.imgBox.e)[1] - px(PLAN_VIEW.imgBox.n, PLAN_VIEW.imgBox.w)[1] : H}
        preserveAspectRatio="none" filter="url(#sepia)" opacity="0.55" />
      {PLAN.zones.map((z) => (
        <g key={z.id}>
          <path d={path(z.poly, true)} fill={z.kind === 'necropolis' ? 'url(#hatch)' : z.kind === 'travertine' ? '#fbf7ee' : 'rgba(181,101,63,.12)'} stroke="#6b4a32" strokeWidth={0.8} strokeDasharray={z.kind === 'necropolis' ? '4 3' : undefined} opacity={0.9} />
          {withLabels && z.label && (() => { const c = z.poly.reduce((a, p) => [a[0] + p[0] / z.poly.length, a[1] + p[1] / z.poly.length], [0, 0]); const [x, y] = px(c[0], c[1]); return <text x={x} y={y} fontSize={11} fill="#6b4a32" textAnchor="middle" fontStyle="italic" letterSpacing="2">{z.label[lang].toUpperCase()}</text> })()}
        </g>
      ))}
      {grid && (
        <g clipPath="url(#city-clip)" opacity={0.7}>
          {gridLines().map((ln, i) => <path key={'g' + i} d={path(ln)} stroke="#8a6a4a" strokeWidth={0.7} fill="none" />)}
        </g>
      )}
      {RUINS.map((r, i) => <path key={'r' + i} d={path(r.p, r.c)} fill={r.c ? (r.k === 'tomb' ? 'rgba(122,90,58,.35)' : 'rgba(90,59,38,.25)') : 'none'} stroke={r.k === 'tomb' ? '#7a5a3a' : '#3b281a'} strokeWidth={r.k === 'wall' ? 2 : 0.9} />)}
      {withLabels && RUIN_LABELS.map((l) => { const [x, y] = px(l.lat, l.lon); return <text key={l.en + l.lat} x={x + 6} y={y - 4} fontSize={8.5} fontStyle="italic" fill="#3b281a">{l[lang]}</text> })}
      {PLAN.walls.map((wl, i) => <path key={i} d={path(wl)} fill="none" stroke="#2b2118" strokeWidth={3} strokeLinejoin="round" />)}
      {PLAN.streets.map((st, i) => <path key={i} d={path(st.line)} fill="none" stroke="#b5653f" strokeWidth={st.main ? 4 : 2} strokeLinecap="round" opacity={0.85} />)}
      {LANDMARKS.map((l, i) => {
        const [x, y] = px(l.lat, l.lon)
        return (
          <g key={l.id}>
            {highlight === l.id && <circle cx={x} cy={y} r={22} fill="none" stroke="#b5653f" strokeWidth={3} />}
            <circle cx={x} cy={y} r={highlight === l.id ? 13 : 9} fill={highlight && highlight !== l.id ? '#a48a6e' : '#b5653f'} stroke="#fff" strokeWidth={1.5} opacity={highlight && highlight !== l.id ? 0.6 : 1} />
            <text x={x} y={y + 3.5} fontSize={highlight === l.id ? 13 : 10} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="Inter, sans-serif">{i + 1}</text>
          </g>
        )
      })}
      {/* north + scale */}
      <g transform={`translate(${W - 40} 40)`}>
        <path d="M0 -24 L9 10 L0 4 L-9 10 Z" fill="#efe2c4" stroke="#2b2118" strokeWidth={1.2} /><path d="M0 -24 L0 4 L-9 10 Z" fill="#2b2118" />
        <text y={26} fontSize={13} textAnchor="middle" fill="#2b2118">N</text>
      </g>
      <g transform={`translate(24 ${H - 24})`}>
        <rect width={scalePx / 2} height={6} fill="#2b2118" /><rect x={scalePx / 2} width={scalePx / 2} height={6} fill="#efe2c4" stroke="#2b2118" />
        <text y={-5} fontSize={11} fill="#2b2118">0</text><text x={scalePx} y={-5} fontSize={11} fill="#2b2118" textAnchor="middle">{scaleM} m</text>
      </g>
    </svg>
  )
}
