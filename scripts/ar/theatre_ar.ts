/** AR build of the Hierapolis theatre: the stage building comes from the live generator (createTheatre),
 * the cavea is rebuilt as a clean revolved surface (profiled marble seat rows, aisle stairs, diazoma,
 * parapet, analemmata) with no hidden geometry, columns are replaced by fluted ones, mouldings are added,
 * and the whole model stands on a paved display plinth. All coordinates are metres. */
import * as THREE from 'three'
import { createTheatre } from '../../src/scene/generators/theatre.ts'
import { getMaterials } from '../../src/scene/materials.ts'
import { TILE } from './textures.ts'
import { Soup, MAT_KEYS, addGeometry, faceNormal, norm, planarUV } from './soup.ts'
import type { MatKey, V2, V3 } from './soup.ts'

// generator defaults (keep in sync with src/scene/generators/theatre.ts)
const R = 50, INNER = 10, ROWS = 45, RISE = 0.4, DEPTH = 0.8, SWEEP = 200 * Math.PI / 180
const SW = 70, SD = 12, SH = 20
const START = Math.PI - SWEEP / 2, END = START + SWEEP
const PITCH = (R - INNER - DEPTH - 2) / (ROWS - 1)
const DIAZOMA = Math.floor(ROWS * 0.53)
const STAGE_Z = Math.max(13, R * 0.3), FRONT_Z = STAGE_Z - SD / 2
const COL_H = SH * 0.43 - 0.3, COL_R = 0.45
const PLINTH_DEPTH = 1.2

const rk = (k: number) => k < ROWS ? INNER + k * PITCH + (k >= DIAZOMA ? 2 : 0) : INNER + (ROWS - 1) * PITCH + 2 + DEPTH
const yk = (k: number) => k * RISE
const P = (r: number, y: number, t: number): V3 => [r * Math.sin(t), y, r * Math.cos(t)]
const NR = (nr: number, ny: number, t: number): V3 => [nr * Math.sin(t), ny, nr * Math.cos(t)]
const GRID = 112
const makeGrid = (n: number) => Array.from({ length: n + 1 }, (_, i) => START + SWEEP * i / n)
const gridAngles = makeGrid(GRID)
/** nested angular grids: chords stay around 0.6–1.6 m from the front rows to the top of the cavea */
const rowGrids = [makeGrid(GRID / 4), makeGrid(GRID / 2), gridAngles]
const rowGrid = (r: number) => rowGrids[r < 20 ? 0 : r < 35 ? 1 : 2]
function anglesIn(a: number, b: number, grid = gridAngles) {
  const out = [a]
  for (const g of grid) if (g > a + 1e-4 && g < b - 1e-4) out.push(g)
  out.push(b)
  return out
}

type ProfilePt = { r: number; y: number; n: [number, number]; v?: number }
/** revolve consecutive profile points as quad strips; uvMode 'seat' uses the per-point v, otherwise world projection */
function revolve(s: Soup, pts: ProfilePt[], thetas: number[], uRadius?: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (Math.hypot(a.r - b.r, a.y - b.y) < 1e-5) continue
    const horiz = Math.abs(b.y - a.y) < Math.abs(b.r - a.r)
    const uv = (p: ProfilePt, t: number): V2 => {
      const u = t * (uRadius ?? p.r) / TILE
      if (p.v !== undefined) return [u, p.v]
      return [u, horiz ? p.r / TILE : -p.y / TILE]
    }
    for (let j = 0; j < thetas.length - 1; j++) {
      const t0 = thetas[j], t1 = thetas[j + 1]
      s.quad(P(a.r, a.y, t0), P(a.r, a.y, t1), P(b.r, b.y, t1), P(b.r, b.y, t0),
        NR(a.n[0], a.n[1], t0), NR(a.n[0], a.n[1], t1), NR(b.n[0], b.n[1], t1), NR(b.n[0], b.n[1], t0),
        uv(a, t0), uv(a, t1), uv(b, t1), uv(b, t0))
    }
  }
}
/** flat-shaded profile: each segment gets its own outward normal (-dy, dr) */
function flatProfile(pts: [number, number][]): ProfilePt[] {
  const out: ProfilePt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i], [r1, y1] = pts[i + 1]
    const l = Math.hypot(r1 - r0, y1 - y0)
    if (l < 1e-6) continue
    const n: [number, number] = [-(y1 - y0) / l, (r1 - r0) / l]
    out.push({ r: r0, y: y0, n }, { r: r1, y: y1, n })
    out.push({ r: NaN, y: NaN, n })
  }
  return out
}
function revolveFlat(s: Soup, pts: [number, number][], thetas: number[], maxSeg = 2.5) {
  // split long segments so AO has vertices to work with
  const dense: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1], [r1, y1] = pts[i]
    const n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / maxSeg))
    for (let k = 1; k <= n; k++) dense.push([r0 + (r1 - r0) * k / n, y0 + (y1 - y0) * k / n])
  }
  // keep collinear sub-segments sharing normals so their vertices merge
  const prof = flatProfile(dense)
  for (let i = 0; i < prof.length; i += 3) revolve(s, [prof[i], prof[i + 1]], thetas)
}

/** 2D polygon in the (r, y) plane at angle t, facing ±tangent */
function radialCap(s: Soup, poly: [number, number][], t: number, sign: number) {
  const contour = poly.map(([r, y]) => new THREE.Vector2(r, y))
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse()
  const tris = THREE.ShapeUtils.triangulateShape(contour, [])
  const n: V3 = [sign * Math.cos(t), 0, -sign * Math.sin(t)]
  for (const [a, b, c] of tris) {
    const pa = contour[a], pb = contour[b], pc = contour[c]
    const uv = (p: THREE.Vector2): V2 => [sign * p.x / TILE, -p.y / TILE]
    s.tri(P(pa.x, pa.y, t), P(pb.x, pb.y, t), P(pc.x, pc.y, t), n, n, n, uv(pa), uv(pb), uv(pc))
  }
}

// ---------- cavea ----------
const SEAT_COURSE = 0.8 // marble texture course height (one seat row per course)
function seatProfile(k: number): ProfilePt[] {
  const r0 = rk(k), r1 = rk(k + 1), y0 = yk(k), y1 = y0 + RISE
  const nf: [number, number] = [-1, 0], nt: [number, number] = [0, 1]
  const ch = norm([-0.06, 0.05, 0]), nc: [number, number] = [ch[0], ch[1]]
  const avg = (a: [number, number], b: [number, number]): [number, number] => { const n = norm([a[0] + b[0], a[1] + b[1], 0]); return [n[0], n[1]] }
  const pts: ProfilePt[] = [
    { r: r0, y: y0, n: nf }, { r: r0, y: y0 + 0.34, n: avg(nf, nc) },
    { r: r0 + 0.05, y: y1, n: avg(nc, nt) }, { r: r1, y: y1, n: nt },
  ]
  let s = 0
  const len = 0.34 + Math.hypot(0.05, 0.06) + (r1 - r0 - 0.05)
  pts.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p.r - pts[i - 1].r, p.y - pts[i - 1].y)
    p.v = ((k + 1) - s / len) * SEAT_COURSE / TILE
  })
  return pts
}
function aisleProfile(k: number): [number, number][] {
  const r0 = rk(k), r1 = rk(k + 1), y0 = yk(k), y1 = y0 + RISE, a = PITCH / 2
  const pts: [number, number][] = [[r0, y0], [r0 + a, y0], [r0 + a, y0 + RISE / 2], [r0 + 2 * a, y0 + RISE / 2], [r0 + 2 * a, y1]]
  if (r1 - (r0 + 2 * a) > 1e-3) pts.push([r1, y1])
  return pts
}
/** angular aisle intervals for a row (constant 1.1 m wide stairs; 8 cunei below the diazoma, 16 above) */
function aisles(k: number) {
  const W = k >= DIAZOMA ? 16 : 8, half = 0.55 / rk(k)
  return Array.from({ length: W - 1 }, (_, j) => { const c = START + (j + 1) * SWEEP / W; return [c - half, c + half] as [number, number] })
}
const OUTER_PROFILE: [number, number][] = [
  [R, ROWS * RISE], [R, ROWS * RISE + 1.2], [R + 1.45, ROWS * RISE + 1.2], [R + 1.45, ROWS * RISE + 0.95],
  [R + 1.2, ROWS * RISE + 0.75], [R + 1.2, 0.6], [R + 1.4, 0.45], [R + 1.4, 0],
]

function buildCavea(soups: Record<MatKey, Soup>) {
  const caps = new Soup()
  for (let k = 0; k < ROWS; k++) {
    const seat = seatProfile(k), aisle = aisleProfile(k)
    let t = START
    const ivs = aisles(k)
    for (const [a, b] of [...ivs, [END, END] as [number, number]]) {
      if (a > t) revolve(soups.marble, seat, anglesIn(t, a, rowGrid(rk(k))), rk(k))
      if (b > a) {
        revolveFlat(soups.limestone, aisle, anglesIn(a, b, rowGrid(rk(k))), 10)
        // seat-block end faces bordering the aisle
        const block: [number, number][] = [...seat.map((p) => [p.r, p.y] as [number, number]), ...aisle.slice(1).reverse()]
        radialCap(soups.marble, dedupe(block), a, +1)
        radialCap(soups.marble, dedupe(block), b, -1)
      }
      t = b
    }
  }
  // parapet, outer wall with crowning cornice and footing course
  revolveFlat(soups.limestone, OUTER_PROFILE, gridAngles)
  // analemmata (end walls)
  const prof: [number, number][] = []
  for (let k = 0; k < ROWS; k++) seatProfile(k).forEach((p, i) => { if (i < 3 || k === ROWS - 1) prof.push([p.r, p.y]) })
  const cap = dedupe([...prof, ...OUTER_PROFILE.slice(1), [INNER, 0]])
  radialCap(caps, cap, START, -1)
  radialCap(caps, cap, END, +1)
  appendSubdivided(soups.limestone, caps, 1.5)
}
function dedupe(p: [number, number][]) {
  return p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > 1e-5)
    .filter((q, i, arr) => i < arr.length - 1 || Math.hypot(q[0] - arr[0][0], q[1] - arr[0][1]) > 1e-5)
}

// ---------- display plinth ----------
const PL_R = 54, PL_FRONT = STAGE_Z + SD / 2 + 4
function plinthR(t: number) {
  const s = Math.sin(t), c = Math.cos(t)
  if (c <= 0.0) return Math.min(PL_R / Math.max(1e-6, Math.abs(s)), PL_R / Math.max(1e-6, Math.hypot(s, c)))
  return Math.min(PL_R / Math.max(1e-6, Math.abs(s)), PL_FRONT / c)
}
function buildPlinth(soups: Record<MatKey, Soup>) {
  const up: V3 = [0, 1, 0]
  const top = (r: number, t: number): V3 => P(r, 0, t)
  const quadTop = (a: V3, b: V3, c: V3, d: V3) => soups.paving.quad(a, b, c, d, up, up, up, up,
    planarUV(a, up), planarUV(b, up), planarUV(c, up), planarUV(d, up))
  const corner = Math.atan2(PL_R, PL_FRONT)
  // front region (outside the cavea sweep): from just under the orchestra rim out to the edge
  const front: number[] = []
  const n = 64
  for (let i = 0; i <= n; i++) front.push(END + (START + 2 * Math.PI - END) * i / n)
  for (const c of [corner + 2 * Math.PI, 2 * Math.PI - corner]) if (!front.some((f) => Math.abs(f - c) < 1e-6)) front.push(c)
  front.sort((a, b) => a - b)
  const RINGS = 14, r0 = 9.9
  for (let j = 0; j < front.length - 1; j++) {
    const ta = front[j], tb = front[j + 1], Ra = plinthR(ta), Rb = plinthR(tb)
    for (let i = 0; i < RINGS; i++) {
      const f0 = i / RINGS, f1 = (i + 1) / RINGS
      quadTop(top(r0 + (Ra - r0) * f0, ta), top(r0 + (Rb - r0) * f0, tb), top(r0 + (Rb - r0) * f1, tb), top(r0 + (Ra - r0) * f1, ta))
    }
  }
  // back region: ring between the outer wall footing and the edge
  const rb = R + 1.4
  for (let j = 0; j < gridAngles.length - 1; j++) {
    const ta = gridAngles[j], tb = gridAngles[j + 1]
    quadTop(top(rb, ta), top(rb, tb), top(plinthR(tb), tb), top(plinthR(ta), ta))
  }
  // sides: chamfered edge then a vertical face, offsets mitred at the front corners
  const outline = [...gridAngles, ...front.slice(1, -1).map((t) => t > 2 * Math.PI ? t - 2 * Math.PI : t)]
    .map((t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b)
  const uniq = outline.filter((t, i) => i === 0 || t - outline[i - 1] > 1e-6)
  const offs = (t: number): [number, number] => {
    const x = PL_R / Math.max(1e-6, Math.abs(Math.sin(t))), r = plinthR(t), p = [r * Math.sin(t), r * Math.cos(t)]
    if (Math.cos(t) <= 0) return [Math.sin(t), Math.cos(t)]
    const onX = Math.abs(r - x) < 1e-4, onZ = Math.abs(p[1] - PL_FRONT) < 1e-4
    return [onX ? Math.sign(p[0]) : 0, onZ ? 1 : 0]
  }
  const ch = 0.35
  for (let i = 0; i < uniq.length; i++) {
    const ta = uniq[i], tb = uniq[(i + 1) % uniq.length]
    const ra = plinthR(ta), rbb = plinthR(tb)
    const A: V3 = P(ra, 0, ta), B: V3 = P(rbb, 0, tb)
    const oa = offs(ta), ob = offs(tb)
    const A1: V3 = [A[0] + oa[0] * ch, -ch, A[2] + oa[1] * ch], B1: V3 = [B[0] + ob[0] * ch, -ch, B[2] + ob[1] * ch]
    const A2: V3 = [A1[0], -PLINTH_DEPTH, A1[2]], B2: V3 = [B1[0], -PLINTH_DEPTH, B1[2]]
    for (const [a, b, c, d] of [[A, B, B1, A1], [A1, B1, B2, A2]] as V3[][]) {
      const fn = faceNormal(a, b, c)
      const out: V3 = Math.hypot(fn[0], fn[2]) > 0 && (fn[0] * (a[0] + b[0]) + fn[2] * (a[2] + b[2])) < 0 ? [-fn[0], -fn[1], -fn[2]] : fn
      soups.limestone.quad(a, b, c, d, out, out, out, out, planarUV(a, out), planarUV(b, out), planarUV(c, out), planarUV(d, out))
    }
  }
}

// ---------- columns & mouldings ----------
const COLS: { x: number; y: number; z: number }[] = []
for (let tier = 0; tier < 2; tier++) for (let i = 0; i < 18; i++) COLS.push({ x: -SW / 2 + 2 + i * (SW - 4) / 17, y: 1.5 + tier * SH * 0.43, z: FRONT_Z - 1 })

function lathe(s: Soup, profile: [number, number][], seg: number, at: V3) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg)
  g.translate(at[0], at[1], at[2])
  const p = g.getAttribute('position'), uv = g.getAttribute('uv'), rows = profile.length
  // u from the segment index (no atan2 wrap at the seam), v from height
  for (let j = 0; j <= seg; j++) for (let k = 0; k < rows; k++) uv.setXY(j * rows + k, (j / seg) * Math.PI / TILE, -p.getY(j * rows + k) / TILE)
  addGeometry(s, g, true)
}
function flutedShaft(s: Soup, at: V3, y0: number, y1: number, r0: number, r1: number) {
  const F = 16, perF = [0, 0.25, 0.5, 0.75], depth = [0, 0.7, 1, 0.7]
  const ring = (rad: number) => {
    const pts: [number, number][] = []
    for (let f = 0; f < F; f++) perF.forEach((q, i) => {
      const a = (f + q) / F * Math.PI * 2, rr = rad - depth[i] * rad * 0.05
      pts.push([rr * Math.sin(a), rr * Math.cos(a)])
    })
    pts.push(pts[0])
    return pts
  }
  const A = ring(r0), B = ring(r1), M = A.length - 1
  const nAt = (ring: [number, number][], i: number): V3 => {
    const p = ring[(i - 1 + M) % M], q = ring[(i + 1) % M]
    return norm([q[1] - p[1], 0, -(q[0] - p[0])])
  }
  const flip = (n: V3, p: [number, number]): V3 => (n[0] * p[0] + n[2] * p[1] < 0 ? [-n[0], 0, -n[2]] : n)
  for (let i = 0; i < M; i++) {
    const a0: V3 = [at[0] + A[i][0], at[1] + y0, at[2] + A[i][1]], a1: V3 = [at[0] + A[i + 1][0], at[1] + y0, at[2] + A[i + 1][1]]
    const b0: V3 = [at[0] + B[i][0], at[1] + y1, at[2] + B[i][1]], b1: V3 = [at[0] + B[i + 1][0], at[1] + y1, at[2] + B[i + 1][1]]
    const n0 = flip(nAt(A, i), A[i]), n1 = flip(nAt(A, (i + 1) % M), A[i + 1])
    const u0 = (i / M) * 2 * Math.PI * r0 / TILE, u1 = ((i + 1) / M) * 2 * Math.PI * r0 / TILE
    s.quad(a0, a1, b1, b0, n0, n1, n1, n0, [u0, -(at[1] + y0) / TILE], [u1, -(at[1] + y0) / TILE], [u1, -(at[1] + y1) / TILE], [u0, -(at[1] + y1) / TILE])
  }
}
function buildColumns(s: Soup) {
  for (const c of COLS) {
    const at: V3 = [c.x, c.y, c.z]
    addGeometry(s, new THREE.BoxGeometry(1.22, 0.12, 1.22).translate(c.x, c.y + 0.06, c.z))
    lathe(s, [[0.58, 0.12], [0.61, 0.16], [0.58, 0.22], [0.5, 0.25], [0.47, 0.29]], 12, at)
    flutedShaft(s, at, 0.29, COL_H - 0.55, COL_R, COL_R * 0.86)
    lathe(s, [[0.40, COL_H - 0.55], [0.43, COL_H - 0.48], [0.5, COL_H - 0.34], [0.62, COL_H - 0.18]], 12, at)
    addGeometry(s, new THREE.BoxGeometry(1.32, 0.18, 1.32).translate(c.x, c.y + COL_H - 0.09, c.z))
  }
}
/** a moulding: closed (dz, dy) profile extruded along X; open edge from the last to the first point is skipped */
function extrudeX(s: Soup, prof: [number, number][], x0: number, x1: number, z: number, y: number) {
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[i + 1]
    const l = Math.hypot(z1 - z0, y1 - y0)
    if (l < 1e-6) continue
    const segs = Math.ceil((x1 - x0) / 2)
    for (let k = 0; k < segs; k++) {
      const xa = x0 + (x1 - x0) * k / segs, xb = x0 + (x1 - x0) * (k + 1) / segs
      const a: V3 = [xa, y + y0, z + z0], b: V3 = [xb, y + y0, z + z0], c: V3 = [xb, y + y1, z + z1], d: V3 = [xa, y + y1, z + z1]
      // outward = away from the profile's interior (towards -z / up for these mouldings)
      let n: V3 = [0, (z1 - z0) / l, -(y1 - y0) / l]
      const mid = [(z0 + z1) / 2, (y0 + y1) / 2], cen = prof.reduce((acc, p) => [acc[0] + p[0] / prof.length, acc[1] + p[1] / prof.length], [0, 0])
      if (n[2] * (mid[0] - cen[0]) + n[1] * (mid[1] - cen[1]) < 0) n = [0, -n[1], -n[2]]
      s.quad(a, b, c, d, n, n, n, n, planarUV(a, n), planarUV(b, n), planarUV(c, n), planarUV(d, n))
    }
  }
  const contour = prof.map(([pz, py]) => new THREE.Vector2(pz, py))
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse()
  for (const [x, sx] of [[x0, -1], [x1, 1]] as [number, number][]) {
    const n: V3 = [sx, 0, 0]
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const v = [a, b, c].map((i) => [x, y + contour[i].y, z + contour[i].x] as V3)
      s.tri(v[0], v[1], v[2], n, n, n, planarUV(v[0], n), planarUV(v[1], n), planarUV(v[2], n))
    }
  }
}
function buildMouldings(s: Soup) {
  for (let tier = 0; tier < 2; tier++) {
    const yc = 1.5 + (tier + 1) * SH * 0.43, zf = FRONT_Z - 0.8 - 1.25
    // crowning cyma on the cornice
    extrudeX(s, [[0, 0], [-0.07, 0.04], [-0.15, 0.13], [-0.24, 0.16], [-0.24, 0.22], [0.5, 0.22], [0.5, 0]], -SW / 2 - 0.7, SW / 2 + 0.7, zf, yc + 0.3)
    // bed moulding (quarter round) under the cornice front
    extrudeX(s, [[0, 0], [0.04, -0.07], [0.12, -0.13], [0.3, -0.15], [0.3, 0]], -SW / 2 - 0.5, SW / 2 + 0.5, zf, yc - 0.3)
  }
  // string course along the top of the scaenae frons and the back wall
  extrudeX(s, [[0, 0], [-0.18, 0.1], [-0.18, 0.3], [0.4, 0.3], [0.4, 0]], -SW / 2 - 0.2, SW / 2 + 0.2, FRONT_Z - 0.7, SH + 1.5)
}

// ---------- generator geometry: clip, filter, subdivide ----------
function inCavea(p: V3) {
  const r = Math.hypot(p[0], p[2])
  let a = Math.atan2(p[0], p[2]); if (a < 0) a += 2 * Math.PI
  return r < 0.01 || (r <= R + 1.21 && a >= START - 1e-3 && a <= END + 1e-3)
}
function inColumn(p: V3) {
  return COLS.some((c) => Math.abs(p[0] - c.x) <= 0.66 && Math.abs(p[2] - c.z) <= 0.66 && p[1] >= c.y - 1e-3 && p[1] <= c.y + COL_H + 1e-3)
}
type Vert = { p: V3; n: V3 }
function clipY0(tri: Vert[]): Vert[][] {
  const out: Vert[] = []
  for (let i = 0; i < 3; i++) {
    const a = tri[i], b = tri[(i + 1) % 3]
    const ia = a.p[1] >= -1e-6, ib = b.p[1] >= -1e-6
    if (ia) out.push(a)
    if (ia !== ib) {
      const t = a.p[1] / (a.p[1] - b.p[1])
      const lerp = (u: V3, v: V3): V3 => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t]
      const p = lerp(a.p, b.p); p[1] = 0
      out.push({ p, n: norm(lerp(a.n, b.n)) })
    }
  }
  const tris: Vert[][] = []
  for (let i = 1; i + 1 < out.length; i++) tris.push([out[0], out[i], out[i + 1]])
  return tris
}
function bisect(t: Vert[], L: number, out: Vert[][]) {
  const e = [0, 1, 2].map((i) => { const a = t[i].p, b = t[(i + 1) % 3].p; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) })
  const m = e.indexOf(Math.max(...e))
  if (e[m] <= L || out.length > 2e6) { out.push(t); return }
  const a = t[m], b = t[(m + 1) % 3], c = t[(m + 2) % 3]
  const mid: Vert = { p: [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2, (a.p[2] + b.p[2]) / 2], n: norm([a.n[0] + b.n[0], a.n[1] + b.n[1], a.n[2] + b.n[2]]) }
  bisect([a, mid, c], L, out); bisect([mid, b, c], L, out)
}
function appendSubdivided(dst: Soup, src: Soup, L: number) {
  for (let i = 0; i < src.pos.length; i += 9) {
    const t: Vert[] = [0, 1, 2].map((k) => ({ p: src.pos.slice(i + k * 3, i + k * 3 + 3) as V3, n: src.nrm.slice(i + k * 3, i + k * 3 + 3) as V3 }))
    const uvs = [0, 1, 2].map((k) => src.uv.slice((i / 3 + k) * 2, (i / 3 + k) * 2 + 2) as V2)
    const out: Vert[][] = []
    bisect(t, L, out)
    // barycentric UV interpolation from the source triangle
    const A = t[0].p, B = t[1].p, C = t[2].p
    const v0 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
    const d00 = v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2], d01 = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2], d11 = v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]
    const den = d00 * d11 - d01 * d01
    const uvAt = (p: V3): V2 => {
      const v2 = [p[0] - A[0], p[1] - A[1], p[2] - A[2]]
      const d20 = v2[0] * v0[0] + v2[1] * v0[1] + v2[2] * v0[2], d21 = v2[0] * v1[0] + v2[1] * v1[1] + v2[2] * v1[2]
      const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den, u = 1 - v - w
      return [u * uvs[0][0] + v * uvs[1][0] + w * uvs[2][0], u * uvs[0][1] + v * uvs[1][1] + w * uvs[2][1]]
    }
    for (const q of out) dst.tri(q[0].p, q[1].p, q[2].p, q[0].n, q[1].n, q[2].n, uvAt(q[0].p), uvAt(q[1].p), uvAt(q[2].p))
  }
}

function generatorParts(soups: Record<MatKey, Soup>) {
  const g = createTheatre()
  g.updateMatrixWorld(true)
  const mats = getMaterials() as unknown as Record<string, THREE.Material>
  const keyOf = (m: THREE.Material) => (Object.keys(mats).find((k) => mats[k] === m) ?? 'limestone') as MatKey
  const raw: Record<MatKey, Soup> = { limestone: new Soup(), travertine: new Soup(), marble: new Soup(), paving: new Soup() }
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return // instanced = seat blocks, rebuilt as profiled rows
    const key = keyOf(m.material as THREE.Material)
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld)
    const ng = geo.index ? geo.toNonIndexed() : geo
    const Pa = ng.getAttribute('position'), Na = ng.getAttribute('normal')
    for (let i = 0; i < Pa.count; i += 3) {
      const tri: Vert[] = [0, 1, 2].map((k) => ({ p: [Pa.getX(i + k), Pa.getY(i + k), Pa.getZ(i + k)] as V3, n: [Na.getX(i + k), Na.getY(i + k), Na.getZ(i + k)] as V3 }))
      if (key === 'limestone' && tri.every((v) => inCavea(v.p))) continue // old stepped sectors + foundation
      if (key === 'marble' && tri.every((v) => inColumn(v.p))) continue // plain 8-sided columns
      for (const t of clipY0(tri)) {
        const fn = faceNormal(t[0].p, t[1].p, t[2].p)
        const n = fn[1] < -0.9 && Math.max(t[0].p[1], t[1].p[1], t[2].p[1]) < 0.01 ? null : fn
        if (!n) continue // faces resting on the ground
        // floors at stage / orchestra level become flagstone paving
        const cy = (t[0].p[1] + t[1].p[1] + t[2].p[1]) / 3
        const dst = (key === 'limestone' || key === 'travertine') && n[1] > 0.95 && cy < 2 ? raw.paving : raw[key]
        dst.tri(t[0].p, t[1].p, t[2].p, t[0].n, t[1].n, t[2].n, planarUV(t[0].p, n), planarUV(t[1].p, n), planarUV(t[2].p, n))
      }
    }
  })
  for (const k of MAT_KEYS) appendSubdivided(soups[k], raw[k], 2.2)
}

export function buildTheatreAR() {
  const soups: Record<MatKey, Soup> = { limestone: new Soup(), travertine: new Soup(), marble: new Soup(), paving: new Soup() }
  generatorParts(soups)
  buildCavea(soups)
  buildPlinth(soups)
  buildColumns(soups.marble)
  buildMouldings(soups.marble)
  // flat roof terrace over the stage building, 0.4 m below the wall tops (stops it reading as an empty box from above)
  const roof = new Soup()
  addGeometry(roof, new THREE.BoxGeometry(SW - 2, 0.4, SD - 1.2).translate(0, SH + 1.5 - 0.6, STAGE_Z + 0.1))
  appendSubdivided(soups.paving, roof, 2.2)
  return { soups, plinthDepth: PLINTH_DEPTH }
}
