import { ERAS } from '../content/timeline'
import type { Landmark, L10n } from '../content/types'

/** Geometry helpers for the printed wall map: a metric projection into millimetres, terrain contours and relief. */

export type LL = [number, number] // [lat, lon]
export interface Rect { x: number; y: number; w: number; h: number }
export interface Bounds { s: number; n: number; w: number; e: number }

const M_LAT = 110574

export interface Projector {
  /** [lat, lon] → poster millimetres */
  p: (lat: number, lon: number) => [number, number]
  /** millimetres per metre on paper */
  k: number
  /** printed scale denominator (1 : denom) */
  denom: number
  rect: Rect
  /** lat/lon of the rect edges, for graticule ticks */
  edges: Bounds
}

/** Fit `bounds` inside `rect` at a round printed scale (denominator rounded up to the nearest `round`). */
export function makeProjector(bounds: Bounds, rect: Rect, round = 250, clamp?: Bounds): Projector {
  let lat0 = (bounds.s + bounds.n) / 2, lon0 = (bounds.w + bounds.e) / 2
  const mLon = M_LAT * Math.cos((lat0 * Math.PI) / 180)
  const wM = (bounds.e - bounds.w) * mLon, hM = (bounds.n - bounds.s) * M_LAT
  const raw = Math.min(rect.w / wM, rect.h / hM)
  const denom = Math.ceil(1000 / raw / round) * round
  const k = 1000 / denom
  if (clamp) {
    // slide the view (never rescale) so the frame stays inside the area covered by imagery
    const hLat = rect.h / 2 / (M_LAT * k), hLon = rect.w / 2 / (mLon * k)
    lat0 = Math.min(Math.max(lat0, clamp.s + hLat), clamp.n - hLat)
    lon0 = Math.min(Math.max(lon0, clamp.w + hLon), clamp.e - hLon)
  }
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2
  const p = (lat: number, lon: number): [number, number] => [cx + (lon - lon0) * mLon * k, cy - (lat - lat0) * M_LAT * k]
  const edges = {
    w: lon0 - rect.w / 2 / (mLon * k), e: lon0 + rect.w / 2 / (mLon * k),
    n: lat0 + rect.h / 2 / (M_LAT * k), s: lat0 - rect.h / 2 / (M_LAT * k),
  }
  return { p, k, denom, rect, edges }
}

export const pathOf = (proj: Projector, pts: LL[], close = false) =>
  pts.map(([la, lo], i) => (i ? 'L' : 'M') + proj.p(la, lo).map((v) => v.toFixed(2)).join(' ')).join('') + (close ? 'Z' : '')

/** Era a year belongs to, with a pre-Hellenistic band for the Phrygian cult place. */
export const PHRYGIAN = { id: 'phrygian', from: -800, to: -200, color: '#5b4636', label: { en: 'Phrygian', tr: 'Frig' } as L10n }
export const NATURE = { color: '#3f7f8f', label: { en: 'Natural feature', tr: 'Doğal oluşum' } as L10n }
export function eraOf(year: number) {
  if (year < -200) return PHRYGIAN
  return ERAS.find((e) => year >= e.from && year < e.to) ?? ERAS[ERAS.length - 1]
}
export const markerColor = (l: Landmark) => (l.category === 'nature' ? NATURE.color : eraOf(l.built).color)

/** In use in a given year (monuments without an end date are still standing). */
export const standing = (l: Landmark, year: number) => l.built <= year && (l.until ?? 3000) >= year

// ---------- terrain ----------

export interface TerrainGrid {
  g: number
  bbox: Bounds
  /** absolute elevation, m above sea level, row 0 = north */
  h: Float32Array
}

let terrainP: Promise<TerrainGrid> | null = null
export function loadTerrainGrid(): Promise<TerrainGrid> {
  terrainP ??= (async () => {
    const [meta, buf] = await Promise.all([
      fetch('/terrain/meta.json').then((r) => r.json() as Promise<{ grid: number; bbox: Bounds }>),
      fetch('/terrain/height.bin').then((r) => r.arrayBuffer()),
    ])
    const g = meta.grid, raw = new Float32Array(buf), h = new Float32Array(g * g)
    // light 3×3 blur so 13 m cells don't give stair-stepped contours
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      let s = 0, n = 0
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj
        if (ii < 0 || jj < 0 || ii >= g || jj >= g) continue
        const w = di === 0 && dj === 0 ? 4 : di === 0 || dj === 0 ? 2 : 1
        s += raw[jj * g + ii] * w; n += w
      }
      h[j * g + i] = s / n
    }
    return { g, bbox: meta.bbox, h }
  })()
  return terrainP
}

const cellLL = (t: TerrainGrid, i: number, j: number): LL => [
  t.bbox.n - (j / (t.g - 1)) * (t.bbox.n - t.bbox.s),
  t.bbox.w + (i / (t.g - 1)) * (t.bbox.e - t.bbox.w),
]

/**
 * Marching-squares contours clipped to `view`, returned as SVG path data in poster millimetres.
 * `minor` and `major` are intervals in metres; major lines are left out of the minor path.
 */
export function contourPaths(t: TerrainGrid, proj: Projector, minor = 5, major = 25) {
  const { g, h } = t, v = proj.edges
  const iOf = (lon: number) => ((lon - t.bbox.w) / (t.bbox.e - t.bbox.w)) * (g - 1)
  const jOf = (lat: number) => ((t.bbox.n - lat) / (t.bbox.n - t.bbox.s)) * (g - 1)
  const i0 = Math.max(0, Math.floor(iOf(v.w)) - 1), i1 = Math.min(g - 2, Math.ceil(iOf(v.e)) + 1)
  const j0 = Math.max(0, Math.floor(jOf(v.n)) - 1), j1 = Math.min(g - 2, Math.ceil(jOf(v.s)) + 1)
  const P = (i: number, j: number) => { const [la, lo] = cellLL(t, i, j); return proj.p(la, lo) }
  const seg: Record<'minor' | 'major', string[]> = { minor: [], major: [] }
  let lo = Infinity, hi = -Infinity
  for (let j = j0; j <= j1 + 1; j++) for (let i = i0; i <= i1 + 1; i++) { const z = h[j * g + i]; if (z < lo) lo = z; if (z > hi) hi = z }
  for (let lvl = Math.ceil(lo / minor) * minor; lvl <= hi; lvl += minor) {
    const out = lvl % major === 0 ? seg.major : seg.minor
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = h[j * g + i], b = h[j * g + i + 1], c = h[(j + 1) * g + i + 1], d = h[(j + 1) * g + i]
      const idx = (a > lvl ? 8 : 0) | (b > lvl ? 4 : 0) | (c > lvl ? 2 : 0) | (d > lvl ? 1 : 0)
      if (idx === 0 || idx === 15) continue
      const lerp = (z0: number, z1: number) => (lvl - z0) / (z1 - z0)
      const top = () => P(i + lerp(a, b), j), right = () => P(i + 1, j + lerp(b, c))
      const bottom = () => P(i + lerp(d, c), j + 1), left = () => P(i, j + lerp(a, d))
      const L = (p: [number, number], q: [number, number]) => out.push(`M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${q[0].toFixed(2)} ${q[1].toFixed(2)}`)
      switch (idx) {
        case 1: case 14: L(left(), bottom()); break
        case 2: case 13: L(bottom(), right()); break
        case 3: case 12: L(left(), right()); break
        case 4: case 11: L(top(), right()); break
        case 6: case 9: L(top(), bottom()); break
        case 7: case 8: L(left(), top()); break
        case 5: L(left(), top()); L(bottom(), right()); break
        case 10: L(left(), bottom()); L(top(), right()); break
      }
    }
  }
  return { minor: seg.minor.join(''), major: seg.major.join(''), lo, hi }
}

/** Hillshade (sun from the north-west) as a transparent PNG covering the terrain bbox. */
export function hillshadeURL(t: TerrainGrid, dark = false): string {
  const { g, h } = t
  const cellX = ((t.bbox.e - t.bbox.w) * M_LAT * Math.cos((37.925 * Math.PI) / 180)) / (g - 1)
  const cellY = ((t.bbox.n - t.bbox.s) * M_LAT) / (g - 1)
  const azMath = ((360 - 315 + 90) * Math.PI) / 180, zen = (45 * Math.PI) / 180, zf = 1.6
  const small = document.createElement('canvas'); small.width = g; small.height = g
  const ctx = small.getContext('2d')!, img = ctx.createImageData(g, g)
  const at = (i: number, j: number) => h[Math.min(g - 1, Math.max(0, j)) * g + Math.min(g - 1, Math.max(0, i))]
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    const dzdx = ((at(i + 1, j) - at(i - 1, j)) / (2 * cellX)) * zf
    const dzdy = ((at(i, j + 1) - at(i, j - 1)) / (2 * cellY)) * zf
    const slope = Math.atan(Math.hypot(dzdx, dzdy))
    const aspect = Math.atan2(dzdy, -dzdx)
    const shade = Math.max(0, Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(azMath - aspect))
    const flat = Math.cos(zen)
    const o = (j * g + i) * 4
    if (shade < flat) { img.data[o] = dark ? 0 : 43; img.data[o + 1] = dark ? 0 : 33; img.data[o + 2] = dark ? 0 : 24; img.data[o + 3] = Math.min(255, (flat - shade) * 330) }
    else { img.data[o] = 255; img.data[o + 1] = 250; img.data[o + 2] = 238; img.data[o + 3] = Math.min(255, (shade - flat) * 260) }
  }
  ctx.putImageData(img, 0, 0)
  const big = document.createElement('canvas'); big.width = g * 4; big.height = g * 4
  const bctx = big.getContext('2d')!
  bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(small, 0, 0, big.width, big.height)
  return big.toDataURL('image/png')
}

/** Short timeline label: the clause before the first colon, semicolon, dash or bracket. */
export function shortLabel(s: string, max = 44) {
  const cut = s.split(/[:;(]| — | – /)[0].trim()
  return cut.length > max ? cut.slice(0, max - 1).trimEnd() + '…' : cut
}

/** First sentence(s) of a summary, up to `max` characters, cut at a sentence end where possible. */
export function lead(s: string, max = 230) {
  if (s.length <= max) return s
  const sentences = s.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [s]
  let out = ''
  for (const x of sentences) { if ((out + x).length > max) break; out += x }
  return (out || s.slice(0, max - 1) + '…').trim()
}

/** Piecewise time axis: more room for the busy Roman and early Byzantine centuries. */
const STOPS: Array<[number, number]> = [[-700, 0], [-200, 0.07], [0, 0.16], [650, 0.86], [1400, 1]]
export function timeX(year: number) {
  for (let i = 1; i < STOPS.length; i++) {
    const [y0, x0] = STOPS[i - 1], [y1, x1] = STOPS[i]
    if (year <= y1) return x0 + ((Math.max(year, y0) - y0) / (y1 - y0)) * (x1 - x0)
  }
  return 1
}
