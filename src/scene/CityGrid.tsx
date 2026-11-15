import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { PLAN } from '../content/plan'
import { GRID } from '../content/grid'
import { RUINS, RUIN_LABELS } from '../content/ruins'
import { getMaterials } from './materials'
import { sceneUniforms } from './Terrain'
import { MONUMENT_FOOTPRINTS } from './footprints'
import { useApp } from '../store'
import { rig } from './camera'

type V2 = [number, number]

function inPoly(x: number, z: number, poly: V2[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Seeded PRNG so the city looks the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** unit box with its base on y=0, white vertex colours (shared materials use vertexColors) */
function unitBox() {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3))
  return g
}
/** unit gable prism: 1 wide (x), ridge 1 high (y), 1 long (z), base on y=0 */
function unitGable() {
  const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)])
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5)
  const ng = g.toNonIndexed(); ng.computeVertexNormals()
  ng.setAttribute('color', new THREE.Float32BufferAttribute(new Array(ng.attributes.position.count * 3).fill(1), 3))
  return ng
}

interface Built {
  walls: THREE.InstancedMesh
  roofs: THREE.InstancedMesh
  streets: THREE.Mesh
  ruins: THREE.Mesh | null
  stats: { insulae: number; houses: number; streetKm: number }
}

/**
 * Whole-city reconstruction: the Hippodamian street grid aligned to the plateia, with every free
 * insula filled with courtyard houses, and OSM-mapped ruins raised as simple masses.
 * Generic and schematic by design (see GRID.note); monuments keep their own detailed models.
 */
function buildCity(t: Terrain): Built {
  const mats = getMaterials()
  const toL = ([la, lo]: [number, number]): V2 => t.toLocal(la, lo)
  const [ax, az] = toL(GRID.axisFrom), [bx, bz] = toL(GRID.axisTo)
  const L = Math.hypot(bx - ax, bz - az)
  const u: V2 = [(bx - ax) / L, (bz - az) / L]
  const v: V2 = [u[1], -u[0]] // +v = east-north-east (theatre side)
  const P = (pu: number, pv: number): V2 => [ax + u[0] * pu + v[0] * pv, az + u[1] * pu + v[1] * pv]

  const region = GRID.region.map(toL)
  const excluded = [
    ...PLAN.zones.map((z) => z.poly.map(toL)),
    ...RUINS.filter((r) => r.c && r.k === 'ruin').map((r) => r.p.map(toL)),
  ]
  const free = (x: number, z: number, pad = 0) => {
    if (!inPoly(x, z, region)) return false
    if (excluded.some((p) => inPoly(x, z, p))) return false
    return !MONUMENT_FOOTPRINTS.some((f) => f.contains(x, z, pad))
  }
  const slopeOk = (pts: V2[], max: number) => {
    const hs = pts.map(([x, z]) => t.heightAt(x, z))
    return Math.max(...hs) - Math.min(...hs) <= max
  }

  const rand = rng(1957) // year the Italian mission began excavating
  const wallM: THREE.Matrix4[] = [], roofM: THREE.Matrix4[] = []
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0)
  const yaw = Math.atan2(u[0], u[1]) // rotation that maps local +z onto u
  q.setFromAxisAngle(yAxis, yaw)
  const push = (arr: THREE.Matrix4[], cx: number, cz: number, y: number, sx: number, sy: number, sz: number) => {
    arr.push(m4.clone().compose(new THREE.Vector3(cx, y, cz), q, new THREE.Vector3(sx, sy, sz)))
  }
  /** a box aligned to the grid, given in (pu, pv) lot coordinates, with a gable roof on top */
  const wing = (cu: number, cv: number, lu: number, lv: number, h: number, base: number, roof: boolean) => {
    const [x, z] = P(cu, cv)
    // grid-aligned: local z along u (length lu), local x along v (width lv)
    const sink = 1.5
    push(wallM, x, z, base - sink, lv, h + sink, lu)
    if (roof) {
      const ridgeAlongU = lu >= lv
      const w = ridgeAlongU ? lv : lu, len = ridgeAlongU ? lu : lv
      const rq = ridgeAlongU ? q : q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, Math.PI / 2))
      roofM.push(m4.clone().compose(new THREE.Vector3(x, base + h, z), rq, new THREE.Vector3(w + 0.8, Math.min(2.4, w * 0.32), len + 0.6)))
    }
  }

  let insulae = 0, houses = 0
  const nU = Math.floor(L / GRID.pitchU)
  const streetSegs = new Map<string, { a: V2; b: V2; w: number }>()
  const addStreet = (key: string, a: V2, b: V2, w: number) => {
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2
    if (!streetSegs.has(key) && inPoly(mx, mz, region) && !excluded.slice(0, PLAN.zones.length).some((p) => inPoly(mx, mz, p)) && slopeOk([a, b], 14))
      streetSegs.set(key, { a, b, w })
  }

  for (const side of [1, -1] as const) {
    const blocks = side > 0 ? GRID.blocksEast : GRID.blocksWest
    for (let m = 0; m < blocks; m++) {
      const v0 = GRID.mainHalf + m * GRID.pitchV
      const v1 = v0 + GRID.pitchV - GRID.plateiaW
      for (let k = 0; k < nU; k++) {
        const u0 = k * GRID.pitchU + GRID.stenoposW / 2, u1 = (k + 1) * GRID.pitchU - GRID.stenoposW / 2
        // streets around this insula (stenopos on the north edge, plateia on the outer edge)
        const sv0 = side * v0, sv1 = side * (v1 + GRID.plateiaW / 2)
        addStreet(`s${k}:${side}:${m}`, P(k * GRID.pitchU, sv0), P(k * GRID.pitchU, side * (v0 + GRID.pitchV)), GRID.stenoposW)
        addStreet(`p${k}:${side}:${m}`, P(k * GRID.pitchU, sv1), P((k + 1) * GRID.pitchU, sv1), GRID.plateiaW)

        // lots: 2 along u x 4 along v
        const lotsU = 2, lotsV = 4
        const du = (u1 - u0) / lotsU, dv = (v1 - v0) / lotsV
        let any = false
        for (let i = 0; i < lotsU; i++) for (let j = 0; j < lotsV; j++) {
          const cu = u0 + du * (i + 0.5), cvAbs = v0 + dv * (j + 0.5), cv = side * cvAbs
          const corners: V2[] = [P(cu - du / 2, cv - dv / 2), P(cu + du / 2, cv - dv / 2), P(cu - du / 2, cv + dv / 2), P(cu + du / 2, cv + dv / 2)]
          const [cx, cz] = P(cu, cv)
          if (!free(cx, cz, 2) || !corners.every(([x, z]) => free(x, z, 1)) || !slopeOk(corners, 7)) continue
          any = true
          const r = rand()
          if (r < 0.1) continue // garden / open yard
          const base = Math.min(...corners.map(([x, z]) => t.heightAt(x, z)))
          const iu = du - 1.2, iv = dv - 1.2
          const h = 4.2 + rand() * 2.2 + (rand() < 0.25 ? 3 : 0)
          houses++
          if (j === 0 && m === 0) {
            // tabernae: a row of shops opening onto the colonnaded main street
            wing(cu, side * (v0 + 3.5), iu, 6.5, 4.4, base, true)
            wing(cu, side * (v0 + 6.5 + (iv - 6.5) / 2 + 0.3), iu * 0.9, iv - 7.5, h, base, true)
          } else if (r < 0.75) {
            // peristyle / courtyard house: four wings round an open court
            const d = 4.5 + rand() * 1.2
            const vv = cv
            wing(cu - iu / 2 + d / 2, vv, d, iv, h, base, true)
            wing(cu + iu / 2 - d / 2, vv, d, iv, h * 0.85, base, true)
            wing(cu, vv - (iv / 2 - d / 2), iu - 2 * d, d, h * 0.8, base, true)
            wing(cu, vv + (iv / 2 - d / 2), iu - 2 * d, d, h * 0.8, base, true)
          } else {
            // block house with a small yard
            wing(cu, cv - side * dv * 0.12, iu * (0.8 + rand() * 0.15), iv * 0.7, h, base, true)
          }
        }
        if (any) insulae++
      }
    }
  }

  // street ribbons draped on the terrain
  const pos: number[] = [], idx: number[] = []
  let streetLen = 0
  for (const { a, b, w } of streetSegs.values()) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); streetLen += len
    const n = Math.max(1, Math.ceil(len / 5))
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, px = -dz * w / 2, pz = dx * w / 2
    const start = pos.length / 3
    for (let s = 0; s <= n; s++) {
      const x = a[0] + (b[0] - a[0]) * (s / n), z = a[1] + (b[1] - a[1]) * (s / n)
      pos.push(x + px, t.heightAt(x + px, z + pz) + 0.25, z + pz, x - px, t.heightAt(x - px, z - pz) + 0.25, z - pz)
      if (s > 0) { const o = start + (s - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2) }
    }
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals()
  const streetMat = new THREE.MeshStandardMaterial({ color: GRID.paving, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const streets = new THREE.Mesh(sg, streetMat); streets.receiveShadow = true; streets.renderOrder = 1

  // OSM-mapped ruins (houses, gymnasium, nymphaea…) raised as simple masses, unless a detailed model stands there
  const ruinGeos: THREE.BufferGeometry[] = []
  for (const r of RUINS) {
    if (!r.c || r.k !== 'ruin') continue
    const pts = r.p.map(toL)
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length
    let area = 0
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
    area = Math.abs(area / 2)
    if (area > 9000 || area < 40 || MONUMENT_FOOTPRINTS.some((f) => f.contains(cx, cz, 4))) continue
    const base = Math.min(...pts.map(([x, z]) => t.heightAt(x, z)))
    const h = area > 2500 ? 9 : 6.5
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: h + 1.5, bevelEnabled: false })
    g.rotateX(-Math.PI / 2).translate(0, base - 1.5, 0)
    const ng = g.toNonIndexed(); ng.computeVertexNormals()
    ng.setAttribute('color', new THREE.Float32BufferAttribute(new Array(ng.attributes.position.count * 3).fill(0.97), 3))
    ruinGeos.push(ng)
  }
  let ruins: THREE.Mesh | null = null
  if (ruinGeos.length) {
    const merged = mergeAll(ruinGeos)
    ruins = new THREE.Mesh(merged, mats.limestone); ruins.castShadow = ruins.receiveShadow = true
  }

  const walls = new THREE.InstancedMesh(unitBox(), mats.plaster, wallM.length)
  wallM.forEach((m, i) => walls.setMatrixAt(i, m))
  const roofs = new THREE.InstancedMesh(unitGable(), mats.roofTile, roofM.length)
  roofM.forEach((m, i) => roofs.setMatrixAt(i, m))
  // per-house colour variation: weathered terracotta of different firings, lime plaster of different ages
  const c = new THREE.Color(), roofTones = ['#c26a43', '#b45a38', '#a8613f', '#c97f55', '#9c5236', '#b8704a'].map((h) => new THREE.Color(h))
  for (let i = 0; i < roofM.length; i++) {
    // instance colour multiplies the shared roof colour, so store tone / base
    const tone = roofTones[Math.floor(rand() * roofTones.length)], k = 0.92 + rand() * 0.14
    c.setRGB(tone.r / ROOF_BASE.r * k, tone.g / ROOF_BASE.g * k, tone.b / ROOF_BASE.b * k)
    roofs.setColorAt(i, c)
  }
  for (let i = 0; i < wallM.length; i++) {
    const w = 0.86 + rand() * 0.16
    walls.setColorAt(i, c.setRGB(w, w * (0.95 + rand() * 0.04), w * (0.88 + rand() * 0.06)))
  }
  for (const im of [walls, roofs]) {
    im.castShadow = im.receiveShadow = true; im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
  }
  return { walls, roofs, streets, ruins, stats: { insulae, houses, streetKm: streetLen / 1000 } }
}

function mergeAll(gs: THREE.BufferGeometry[]) {
  let n = 0; for (const g of gs) n += g.attributes.position.count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3)
  let o = 0
  for (const g of gs) {
    pos.set(g.attributes.position.array as Float32Array, o * 3)
    nor.set(g.attributes.normal.array as Float32Array, o * 3)
    col.set(g.attributes.color.array as Float32Array, o * 3)
    o += g.attributes.position.count; g.dispose()
  }
  const m = new THREE.BufferGeometry()
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  m.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return m
}

const ROOF_BASE = new THREE.Color('#b0603c')
const PAVE = new THREE.Color(GRID.paving), INK = new THREE.Color('#5a4030')

/** Toggleable whole-city layer (store.showGrid). Built lazily the first time it is switched on. */
export function CityGrid({ terrain }: { terrain: Terrain }) {
  const show = useApp((s) => s.showGrid)
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const year = useApp((s) => s.year)
  const lang = useApp((s) => s.lang)
  const group = useRef<THREE.Group>(null)
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])

  const built = useMemo(() => (show ? buildCity(terrain) : null), [show, terrain])
  useEffect(() => {
    if (built && import.meta.env.DEV) console.info('[city grid]', built.stats)
    return () => {
      if (!built) return
      built.walls.dispose(); built.roofs.dispose(); built.streets.geometry.dispose()
      ;(built.streets.material as THREE.Material).dispose(); built.ruins?.geometry.dispose()
    }
  }, [built])

  const labels = useMemo(() => RUIN_LABELS.map((l) => {
    const [x, z] = terrain.toLocal(l.lat, l.lon)
    return { ...l, pos: [x, terrain.heightAt(x, z) + 14, z] as THREE.Vector3Tuple }
  }), [terrain])

  const inYear = mode !== 'plan' || (year >= GRID.built && year <= GRID.until)
  const visible = show && inYear && !(era === 'today' && mode !== 'plan')

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!built) return
    ;(built.streets.material as THREE.MeshStandardMaterial).color.copy(PAVE).lerp(INK, sceneUniforms.uPlan.value * 0.85)
    const cam = rig.camera
    if (!cam || mode === 'plan') return
    labels.forEach((l, i) => {
      const el = labelRefs.current[i]
      if (!el) return
      const d = tmp.set(...l.pos).distanceTo(cam.position)
      el.style.opacity = String(Math.max(0, Math.min(1, (1100 - d) / 300)))
    })
  })

  if (!built) return null
  return (
    <group ref={group} visible={visible}>
      <primitive object={built.streets} />
      <primitive object={built.walls} />
      <primitive object={built.roofs} />
      {built.ruins && <primitive object={built.ruins} />}
      {visible && mode !== 'plan' && labels.map((l, i) => (
        <Html key={l.en + l.lat} position={l.pos} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <span ref={(el) => { labelRefs.current[i] = el }} className="whitespace-nowrap rounded-full bg-black/45 px-2 py-0.5 font-serif text-[11px] italic text-travertine/90 backdrop-blur-sm">{l[lang]}</span>
        </Html>
      ))}
    </group>
  )
}
