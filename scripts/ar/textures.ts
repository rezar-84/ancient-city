/** Procedural, tileable PBR stone textures for the AR export (pure JS, encoded with jpeg-js).
 * Each texture covers TILE metres; every pattern wraps seamlessly at the tile edge. */
import jpeg from 'jpeg-js'

export const TILE = 4 // metres covered by one texture repeat

export interface StoneTextures { base: Buffer; normal: Buffer; orm: Buffer; size: number }

// ---------- tileable noise ----------
function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const fade = (t: number) => t * t * (3 - 2 * t)
/** value noise on a P×P lattice that wraps over the unit square */
function vnoise(u: number, v: number, P: number, s: number) {
  const x = u * P, y = v * P
  const xi = Math.floor(x), yi = Math.floor(y), fx = fade(x - xi), fy = fade(y - yi)
  const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
function fbm(u: number, v: number, P: number, oct: number, s: number) {
  let sum = 0, amp = 0.5, norm = 0
  for (let o = 0; o < oct; o++) { sum += vnoise(u, v, P << o, s + o * 17) * amp; norm += amp; amp *= 0.5 }
  return sum / norm
}
/** anisotropic noise: Px cells across, Py cells down (both integers so it still tiles) */
function anoise(u: number, v: number, Px: number, Py: number, s: number) {
  const x = u * Px, y = v * Py
  const xi = Math.floor(x), yi = Math.floor(y), fx = fade(x - xi), fy = fade(y - yi)
  const x0 = ((xi % Px) + Px) % Px, y0 = ((yi % Py) + Py) % Py, x1 = (x0 + 1) % Px, y1 = (y0 + 1) % Py
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// ---------- block layout ----------
interface Row { y0: number; y1: number; off: number; breaks: number[]; tile: number }
/** rows of staggered blocks that wrap exactly at TILE in both directions */
function layout(rowHeights: number[], bMin: number, bMax: number, seed: number, TILE: number): Row[] {
  const rows: Row[] = []
  let y = 0
  rowHeights.forEach((h, i) => {
    const lens: number[] = []
    let sum = 0, k = 0
    while (sum < TILE - bMin * 0.5) { const l = mix(bMin, bMax, hash(i, k++, seed)); lens.push(l); sum += l }
    const sc = TILE / sum
    const breaks = [0]
    lens.forEach((l) => breaks.push(breaks[breaks.length - 1] + l * sc))
    rows.push({ y0: y, y1: y + h, off: hash(i, 999, seed) * TILE, breaks, tile: TILE })
    y += h
  })
  return rows
}
function rowHeightsUniform(h: number, TILE = 4) { return Array.from({ length: Math.round(TILE / h) }, () => TILE / Math.round(TILE / h)) }
function rowHeightsRandom(hMin: number, hMax: number, seed: number, TILE = 4) {
  const hs: number[] = []
  let s = 0, k = 0
  while (s < TILE - hMin * 0.5) { const h = mix(hMin, hMax, hash(k++, 7, seed)); hs.push(h); s += h }
  return hs.map((h) => h * TILE / s)
}
/** distance to the nearest joint plus a block id for metre coords (x, y) inside the tile */
function cell(rows: Row[], x: number, y: number) {
  let r = 0
  while (r < rows.length - 1 && y >= rows[r].y1) r++
  const row = rows[r]
  const xm = (((x - row.off) % row.tile) + row.tile) % row.tile
  const b = row.breaks
  let j = 0
  while (j < b.length - 2 && xm >= b[j + 1]) j++
  const dx = Math.min(xm - b[j], b[j + 1] - xm), dy = Math.min(y - row.y0, row.y1 - y)
  // local coords inside the block, 0..1
  const lx = (xm - b[j]) / (b[j + 1] - b[j]), ly = (y - row.y0) / (row.y1 - row.y0)
  return { d: Math.min(dx, dy), dx, dy, id: r * 131 + j, lx, ly }
}

// ---------- stone recipes ----------
export interface Recipe {
  seed: number; tile: number // metres covered by this texture (UVs are authored for TILE and rescaled on export)
  rows: number[]; bMin: number; bMax: number
  joint: number; bevel: number; chip: number // metres
  depth: number // metres of relief represented by height 0..1
  color: [number, number, number]; mortar: [number, number, number]
  tint: number; mottle: number; pores: number; veins: number; cracks: number; streaks: number; lichen: number
  rough: number; roughVar: number; jointRough: number
}

export const RECIPES: Record<'limestone' | 'travertine' | 'marble' | 'paving', Recipe> = {
  // cavea retaining walls, aisle stairs, analemmata, plinth: warm limestone ashlar, 0.5 m courses
  limestone: { seed: 11, tile: 8, rows: rowHeightsUniform(0.5, 8), bMin: 1.0, bMax: 2.2, joint: 0.012, bevel: 0.03, chip: 0.035, depth: 0.03,
    color: [0.80, 0.74, 0.63], mortar: [0.60, 0.55, 0.47], tint: 0.045, mottle: 0.1, pores: 0.12, veins: 0, cracks: 0.15, streaks: 0.5, lichen: 0.4,
    rough: 0.86, roughVar: 0.1, jointRough: 0.97 },
  // scaenae frons: creamy Pamukkale travertine, 0.67 m courses, banded pores
  travertine: { seed: 23, tile: TILE, rows: rowHeightsUniform(TILE / 6), bMin: 1.2, bMax: 2.4, joint: 0.01, bevel: 0.025, chip: 0.03, depth: 0.035,
    color: [0.86, 0.81, 0.71], mortar: [0.60, 0.55, 0.47], tint: 0.07, mottle: 0.1, pores: 1, veins: 0, cracks: 0.1, streaks: 0.7, lichen: 0.35,
    rough: 0.82, roughVar: 0.12, jointRough: 0.96 },
  // seats, columns, cornices: white marble, 0.8 m courses (one seat row per course), soft grey veins, honed surface
  marble: { seed: 37, tile: TILE, rows: rowHeightsUniform(0.8), bMin: 1.2, bMax: 2.1, joint: 0.006, bevel: 0.02, chip: 0.018, depth: 0.018,
    color: [0.91, 0.88, 0.83], mortar: [0.62, 0.58, 0.52], tint: 0.045, mottle: 0.06, pores: 0.05, veins: 1, cracks: 0.1, streaks: 0.35, lichen: 0.3,
    rough: 0.62, roughVar: 0.12, jointRough: 0.9 },
  // orchestra / stage floor / display plinth: worn travertine flagstones
  paving: { seed: 53, tile: TILE, rows: rowHeightsRandom(0.55, 1.05, 53), bMin: 0.55, bMax: 1.3, joint: 0.016, bevel: 0.04, chip: 0.03, depth: 0.025,
    color: [0.78, 0.71, 0.60], mortar: [0.46, 0.41, 0.33], tint: 0.1, mottle: 0.14, pores: 0.35, veins: 0, cracks: 0.5, streaks: 0, lichen: 0.45,
    rough: 0.88, roughVar: 0.08, jointRough: 0.98 },
}

const srgbByte = (v: number) => Math.round(clamp(v) * 255)

/** generate base colour (sRGB), tangent-space normal (OpenGL, +Y = image up) and ORM maps */
export function makeStone(r: Recipe, N = 1024): StoneTextures {
  const TILE = r.tile
  const rows = layout(r.rows, r.bMin, r.bMax, r.seed, TILE)
  const H = new Float32Array(N * N)
  const col = new Float32Array(N * N * 3)
  const rough = new Float32Array(N * N)
  const s = r.seed
  for (let j = 0; j < N; j++) {
    const v = (j + 0.5) / N
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N
      const x = u * TILE, y = v * TILE
      const lo = fbm(u, v, 3, 4, s), mid = fbm(u, v, 12, 4, s + 3), hi = fbm(u, v, 96, 3, s + 5)
      // edge chipping: wobble the joint line, with occasional shallow spalls along the arrises
      const bite = smooth(0.64, 0.82, fbm(u, v, 20, 3, s + 9)) * r.chip * 2
      const wob = (mid - 0.5) * r.chip * 0.6 + (hi - 0.5) * r.chip * 0.3
      const c = cell(rows, x, y)
      const d = c.d + wob
      const hb = hash(c.id, 1, s), hb2 = hash(c.id, 2, s), hb3 = hash(c.id, 3, s)
      const edge = smooth(r.joint * 0.5, r.joint * 0.5 + r.bevel, d)
      const chipT = bite > 1e-4 ? 1 - smooth(r.joint * 0.5 + bite * 0.5, r.joint * 0.5 + bite, d) : 0
      // block face: slight pillowing toward the centre, per-block tilt, tooling grain
      const pillow = Math.sin(Math.PI * c.lx) * Math.sin(Math.PI * c.ly)
      let face = 0.82 + 0.08 * pillow + (hb2 - 0.5) * 0.08 * (c.lx - 0.5) + (hb3 - 0.5) * 0.08 * (c.ly - 0.5)
      face += (fbm(u, v, 48, 3, s + 11) - 0.5) * 0.12 + (hi - 0.5) * 0.05
      // travertine pores: horizontally elongated pits
      let pore = 0
      if (r.pores > 0) {
        const pn = anoise(u, v, 160, 520, s + 13) * 0.6 + anoise(u, v, 80, 260, s + 14) * 0.4
        pore = smooth(0.7 - 0.06 * r.pores, 0.82, pn) * r.pores
        face -= pore * 0.45
      }
      // hairline cracks (ridged noise), only in some blocks
      let crack = 0
      if (r.cracks > 0 && hb > 1 - r.cracks * 0.6) {
        const rn = Math.abs(fbm(u, v, 6, 2, s + 17 + c.id) - 0.5)
        crack = (1 - smooth(0.002, 0.007, rn)) * smooth(0.15, 0.3, Math.min(c.lx, 1 - c.lx, c.ly, 1 - c.ly) + 0.2)
        face -= crack * 0.3
      }
      face -= chipT * (0.3 + 0.15 * hi)
      const mortarH = 0.12 + (hi - 0.5) * 0.08
      const h = mix(mortarH, face, edge)
      H[j * N + i] = h

      // ---- colour ----
      const tint = 1 + (hb - 0.5) * 2 * r.tint
      const warm = (hb2 - 0.5) * r.tint * 0.6 // hue shift per block
      let cr = r.color[0] * tint * (1 + warm), cg = r.color[1] * tint, cb = r.color[2] * tint * (1 - warm)
      const mott = 1 + (mid - 0.5) * 2 * r.mottle + (hi - 0.5) * 0.06
      cr *= mott; cg *= mott; cb *= mott
      if (r.veins > 0) {
        // two families of soft grey veins, warped so they wander; integer frequencies keep them tileable
        const w1 = fbm(u, v, 4, 5, s + 21), w2 = fbm(u, v, 6, 4, s + 22)
        const a = Math.abs(Math.sin(Math.PI * (2 * u + 3 * v + 3.2 * w1)))
        const b = Math.abs(Math.sin(Math.PI * (5 * u - 2 * v + 2.6 * w2)))
        const vein = (1 - smooth(0.0, 0.09, a)) * 0.55 + (1 - smooth(0.0, 0.05, b)) * 0.3
        const veinCol = [0.62, 0.63, 0.65]
        const t = vein * r.veins * (0.5 + 0.5 * hb3)
        cr = mix(cr, veinCol[0], t); cg = mix(cg, veinCol[1], t); cb = mix(cb, veinCol[2], t)
      }
      // weathering: lichen / soot patches, rain streaks running down the face
      const patch = smooth(0.56, 0.75, lo) * r.lichen
      cr = mix(cr, cr * 0.72, patch); cg = mix(cg, cg * 0.74, patch); cb = mix(cb, cb * 0.72, patch)
      if (r.streaks > 0) {
        const st = smooth(0.5, 0.9, anoise(u, v, 70, 4, s + 31) * 0.7 + anoise(u, v, 140, 8, s + 33) * 0.3) * smooth(0.35, 0.75, lo + (anoise(u, v, 16, 8, s + 32) - 0.5) * 0.6)
        const f = 1 - st * 0.12 * r.streaks
        cr *= f; cg *= f; cb *= f * 0.99
      }
      // dirt collects in pores, cracks and toward the lower edge of each block
      const grime = pore * 0.3 + crack * 0.3 + smooth(0.6, 1.0, c.ly) * 0.05
      cr *= 1 - grime; cg *= 1 - grime * 1.04; cb *= 1 - grime * 1.1
      // freshly chipped arrises are a touch paler
      const chipped = chipT * edge
      cr = mix(cr, Math.min(1, cr * 1.07), chipped); cg = mix(cg, Math.min(1, cg * 1.06), chipped); cb = mix(cb, Math.min(1, cb * 1.04), chipped)
      // mortar / soil in the joints
      const mj = 1 - edge
      const mn = 0.85 + 0.3 * hi
      cr = mix(cr, r.mortar[0] * mn, mj); cg = mix(cg, r.mortar[1] * mn, mj); cb = mix(cb, r.mortar[2] * mn, mj)
      const k = (j * N + i) * 3
      col[k] = cr; col[k + 1] = cg; col[k + 2] = cb

      // ---- roughness ----
      rough[j * N + i] = clamp(mix(r.rough + (mid - 0.5) * 2 * r.roughVar + (hi - 0.5) * 0.06 + pore * 0.1 + patch * 0.06 + chipT * 0.1, r.jointRough, mj), 0.2, 1)
    }
  }

  // cavity occlusion from the height field: blurred height minus height
  const blur = boxBlur(boxBlur(H, N, 6), N, 6)
  const base = Buffer.alloc(N * N * 4), nrm = Buffer.alloc(N * N * 4), orm = Buffer.alloc(N * N * 4)
  const pxPerM = N / TILE, k = r.depth * pxPerM * 0.5
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const p = j * N + i
      const L = (ii: number, jj: number) => H[((jj + N) % N) * N + ((ii + N) % N)]
      // Sobel gradients (image x to the right, image j downward)
      const gx = (L(i + 1, j - 1) + 2 * L(i + 1, j) + L(i + 1, j + 1) - L(i - 1, j - 1) - 2 * L(i - 1, j) - L(i - 1, j + 1)) / 4
      const gj = (L(i - 1, j + 1) + 2 * L(i, j + 1) + L(i + 1, j + 1) - L(i - 1, j - 1) - 2 * L(i, j - 1) - L(i + 1, j - 1)) / 4
      // tangent space: +X right, +Y image-up (= -j)
      let nx = -gx * k, ny = gj * k, nz = 1
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len
      nrm[p * 4] = srgbByte(nx * 0.5 + 0.5); nrm[p * 4 + 1] = srgbByte(ny * 0.5 + 0.5); nrm[p * 4 + 2] = srgbByte(nz * 0.5 + 0.5); nrm[p * 4 + 3] = 255
      const cav = clamp(1 - Math.max(0, blur[p] - H[p]) * 2.2, 0.35, 1)
      orm[p * 4] = srgbByte(cav); orm[p * 4 + 1] = srgbByte(rough[p]); orm[p * 4 + 2] = 0; orm[p * 4 + 3] = 255
      // fold a little of the cavity into the albedo too, for viewers that ignore occlusion maps
      const ao = 0.75 + 0.25 * cav
      base[p * 4] = srgbByte(col[p * 3] * ao); base[p * 4 + 1] = srgbByte(col[p * 3 + 1] * ao); base[p * 4 + 2] = srgbByte(col[p * 3 + 2] * ao); base[p * 4 + 3] = 255
    }
  }
  const enc = (data: Buffer, q: number) => Buffer.from(jpeg.encode({ data, width: N, height: N }, q).data)
  return { base: enc(base, 86), normal: enc(nrm, 84), orm: enc(orm, 85), size: N }
}

/** separable wrapped box blur */
function boxBlur(src: Float32Array, N: number, R: number) {
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N), w = 2 * R + 1
  for (let j = 0; j < N; j++) {
    let acc = 0
    for (let i = -R; i <= R; i++) acc += src[j * N + ((i + N) % N)]
    for (let i = 0; i < N; i++) {
      tmp[j * N + i] = acc / w
      acc += src[j * N + ((i + R + 1) % N)] - src[j * N + ((i - R + N) % N)]
    }
  }
  for (let i = 0; i < N; i++) {
    let acc = 0
    for (let j = -R; j <= R; j++) acc += tmp[((j + N) % N) * N + i]
    for (let j = 0; j < N; j++) {
      out[j * N + i] = acc / w
      acc += tmp[((j + R + 1) % N) * N + i] - tmp[((j - R + N) % N) * N + i]
    }
  }
  return out
}

// Runtime-only recipes: deliberately separate from RECIPES and makeStone so AR exports stay identical.
export const RUNTIME_RECIPES = {
  plaster: { seed: 71, tile: 4, color: [0.89, 0.85, 0.76], rough: 0.93, depth: 0.004 },
  rooftile: { seed: 83, tile: 4, color: [0.68, 0.34, 0.20], rough: 0.80, depth: 0.065 },
  dirt: { seed: 97, tile: 4, color: [0.56, 0.46, 0.34], rough: 0.96, depth: 0.035 },
  grass: { seed: 109, tile: 4, color: [0.61, 0.56, 0.35], rough: 0.98, depth: 0.018 },
} as const

/** Raw RGBA runtime maps. RG = OpenGL tangent normal XY; B = roughness, A = 255. */
export function makeRuntimeSurface(name: keyof typeof RUNTIME_RECIPES, N = 512) {
  const r = RUNTIME_RECIPES[name], H = new Float32Array(N * N)
  const base = Buffer.alloc(N * N * 4), nr = Buffer.alloc(N * N * 4)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N, p = j * N + i
    const low = fbm(u, v, 4, 4, r.seed), fine = fbm(u, v, 64, 3, r.seed + 1)
    let h = fine * 0.2, tint = 0.9 + low * 0.2 + (fine - 0.5) * 0.12
    if (name === 'plaster') {
      // Broad lime wash and faint overlapping horizontal trowel swipes; no masonry joints.
      const swipe = anoise(u, v, 5, 64, r.seed + 2)
      h += swipe * 0.3; tint += (swipe - 0.5) * 0.045
    } else if (name === 'rooftile') {
      // 10 tegula channels across, 8 overlapping rows; rounded imbrex covers on each seam.
      const x = (u * 10) % 1, y = (v * 8) % 1
      const cover = Math.sqrt(Math.max(0, 1 - (Math.min(x, 1 - x) / 0.16) ** 2))
      const overlap = 1 - smooth(0.02, 0.10, y)
      h += cover * 0.65 + overlap * 0.18
      tint *= 0.86 + 0.28 * hash(Math.floor(u * 10), Math.floor(v * 8), r.seed)
      tint *= 0.80 + 0.20 * smooth(0, 0.035, y)
    } else {
      // Periodic cellular gravel, with elongated dry straw laid over the grass variant.
      const gravel = smooth(0.48, 0.74, vnoise(u, v, 100, r.seed + 4))
      h += gravel * 0.7; tint += gravel * 0.15
      if (name === 'grass') {
        const straw = smooth(0.52, 0.72, anoise(u, v, 180, 24, r.seed + 5))
        const cross = smooth(0.57, 0.78, anoise(u, v, 20, 160, r.seed + 6))
        h += straw * 0.3 + cross * 0.2; tint += straw * 0.22 + cross * 0.1
      }
    }
    H[p] = h
    for (let c = 0; c < 3; c++) base[p * 4 + c] = srgbByte(r.color[c] * tint)
    base[p * 4 + 3] = nr[p * 4 + 3] = 255
    nr[p * 4 + 2] = srgbByte(r.rough + (fine - 0.5) * 0.08)
  }
  const k = r.depth * N / r.tile * 0.5
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const p = j * N + i
    const x = -(H[j * N + (i + 1) % N] - H[j * N + (i + N - 1) % N]) * k
    const y = (H[((j + 1) % N) * N + i] - H[((j + N - 1) % N) * N + i]) * k
    const len = Math.hypot(x, y, 1)
    nr[p * 4] = srgbByte(x / len * 0.5 + 0.5)
    nr[p * 4 + 1] = srgbByte(y / len * 0.5 + 0.5)
  }
  return { base, nr, size: N }
}
