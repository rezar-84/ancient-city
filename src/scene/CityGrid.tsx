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

/** unit hipped roof: 1 x 1 base on y=0, ridge 1 high along z between z = ±0.22 */
function unitHip() {
  const p = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [0, 1, -0.22], [0, 1, 0.22]]
  const tri = [[0, 4, 1], [2, 5, 3], [1, 4, 5], [1, 5, 2], [3, 5, 4], [3, 4, 0]]
  const pos: number[] = []
  for (const t of tri) for (const i of t) pos.push(...p[i])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals()
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3))
  return g
}
/** unit lean-to (shed) roof: high (1) at x = -0.5, eaves (0) at x = +0.5, so it drains toward +x */
function unitShed() {
  const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(-0.5, 1)])
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5)
  const ng = g.toNonIndexed(); ng.computeVertexNormals()
  ng.setAttribute('color', new THREE.Float32BufferAttribute(new Array(ng.attributes.position.count * 3).fill(1), 3))
  return ng
}

type RoofKind = 'gable' | 'hip' | 'shed'

interface Built {
  walls: THREE.InstancedMesh
  roofs: THREE.InstancedMesh[]
  courts: THREE.InstancedMesh
  piers: THREE.InstancedMesh
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
  const wallM: THREE.Matrix4[] = [], courtM: THREE.Matrix4[] = [], pierM: THREE.Matrix4[] = []
  const roofM: Record<RoofKind, THREE.Matrix4[]> = { gable: [], hip: [], shed: [] }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0)
  const yaw = Math.atan2(u[0], u[1]) // rotation that maps local +z onto u (and local +x onto v)
  q.setFromAxisAngle(yAxis, yaw)
  const qTurn = (a: number) => q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, a))
  const push = (arr: THREE.Matrix4[], cx: number, cz: number, y: number, sx: number, sy: number, sz: number, rq = q) => {
    arr.push(m4.clone().compose(new THREE.Vector3(cx, y, cz), rq, new THREE.Vector3(sx, sy, sz)))
  }
  let pitch = 0.3
  /** a box aligned to the grid, given in (pu, pv) lot coordinates, with a roof on top.
   * shed roofs drain toward `drain` (one of +u, -u, +v, -v): the courtyard of a peristyle house. */
  const wing = (cu: number, cv: number, lu: number, lv: number, h: number, base: number, roof: RoofKind | null, drain?: 'u+' | 'u-' | 'v+' | 'v-') => {
    const [x, z] = P(cu, cv)
    // grid-aligned: local z along u (length lu), local x along v (width lv)
    const sink = 1.5
    push(wallM, x, z, base - sink, lv, h + sink, lu)
    if (!roof) return
    const top = base + h
    if (roof === 'shed' && drain) {
      // rotate the unit shed so its +x (eaves side) points to the drain direction
      const a = drain === 'v+' ? 0 : drain === 'v-' ? Math.PI : drain === 'u+' ? -Math.PI / 2 : Math.PI / 2
      const across = drain[0] === 'v' ? lv : lu, len = drain[0] === 'v' ? lu : lv
      push(roofM.shed, x, z, top, across + 0.7, Math.min(1.9, across * pitch * 0.8), len + 0.5, qTurn(a))
      return
    }
    const ridgeAlongU = lu >= lv
    const w = ridgeAlongU ? lv : lu, len = ridgeAlongU ? lu : lv
    push(roofM[roof === 'shed' ? 'gable' : roof], x, z, top, w + 0.8, Math.min(2.6, w * pitch), len + 0.6, ridgeAlongU ? q : qTurn(Math.PI / 2))
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
          pitch = 0.24 + rand() * 0.12 // roof pitch varies house to house
          houses++
          if (j === 0 && m === 0) {
            // tabernae: a row of shops opening onto the colonnaded main street, lean-to roofs draining to the street
            wing(cu, side * (v0 + 3.5), iu, 6.5, 4.4, base, 'shed', side > 0 ? 'v-' : 'v+')
            wing(cu, side * (v0 + 6.5 + (iv - 6.5) / 2 + 0.3), iu * 0.9, iv - 7.5, h, base, rand() < 0.5 ? 'hip' : 'gable')
          } else if (r < 0.75) {
            // peristyle / courtyard house: four wings round an open court; roofs either drain into the court
            // (compluviate lean-tos) or are plain gables; a paved court with a portico of piers on the long sides
            const d = 4.5 + rand() * 1.2
            const vv = cv
            const inward = rand() < 0.6
            const k: RoofKind = inward ? 'shed' : 'gable'
            const hi = rand() < 0.3 ? 2.6 : 0 // a two-storey main wing
            wing(cu - iu / 2 + d / 2, vv, d, iv, h + hi, base, k, 'u+')
            wing(cu + iu / 2 - d / 2, vv, d, iv, h * 0.85, base, k, 'u-')
            wing(cu, vv - (iv / 2 - d / 2), iu - 2 * d, d, h * 0.8, base, k, 'v+')
            wing(cu, vv + (iv / 2 - d / 2), iu - 2 * d, d, h * 0.8, base, k, 'v-')
            const cuL = iu - 2 * d, cvL = iv - 2 * d
            if (cuL > 3 && cvL > 3) {
              const [x, z] = P(cu, vv)
              push(courtM, x, z, base - 0.6, cvL, 0.75, cuL)
              // piers along the two long sides of the court, 0.9 m in front of the wing walls
              const ph = h * 0.8 - 0.4, n = Math.max(2, Math.round((cvL - 1) / 3))
              for (const sgn of [-1, 1]) for (let s2 = 0; s2 < n; s2++) {
                const pv = vv - cvL / 2 + 0.6 + (s2 + 0.5) * (cvL - 1.2) / n
                const [px, pz] = P(cu + sgn * (cuL / 2 - 0.9), pv)
                push(pierM, px, pz, base, 0.42, ph, 0.42)
              }
            }
          } else {
            // block house with a yard; often an L with a lower annex under a lean-to
            const bw = iu * (0.8 + rand() * 0.15), bv = iv * 0.7
            const bc = cv - side * dv * 0.12
            wing(cu, bc, bw, bv, h, base, rand() < 0.55 ? 'hip' : 'gable')
            if (rand() < 0.5) {
              const sideU = rand() < 0.5 ? -1 : 1
              wing(cu + sideU * (bw / 2 - 2.2), bc + side * (bv / 2 + 2.4), 4.4, 4.8, h * 0.62, base, 'shed', side > 0 ? 'v+' : 'v-')
            }
          }
        }
        if (any) insulae++
      }
    }
  }

  // street ribbons draped on the terrain. Plateiai get raised kerbs and gutters; stenopoi are plain lanes.
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  let streetLen = 0
  const KERB = 0.2, KW = 0.55
  for (const { a, b, w } of streetSegs.values()) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); streetLen += len
    const n = Math.max(1, Math.ceil(len / 5))
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, nx = -dz, nz = dx
    // cross profile: [offset across, lift, shade]; consecutive pairs become strips with their own vertices
    const h2 = w / 2
    const prof: [number, number, number][] = w >= 4
      ? [[-h2, KERB, 1.1], [-h2 + KW, KERB, 1.06], [-h2 + KW, 0, 0.78], [-h2 + KW + 0.35, 0, 0.9], [h2 - KW - 0.35, 0, 1.0], [h2 - KW, 0, 0.78], [h2 - KW, KERB, 1.06], [h2, KERB, 1.1]]
      : [[-h2, 0, 0.92], [0, 0, 1.0], [h2, 0, 0.92]]
    for (let p = 0; p < prof.length - 1; p++) {
      const [o0, l0, c0] = prof[p], [o1, l1, c1] = prof[p + 1]
      const start = pos.length / 3
      for (let s = 0; s <= n; s++) {
        const x = a[0] + (b[0] - a[0]) * (s / n), z = a[1] + (b[1] - a[1]) * (s / n)
        const ym = t.heightAt(x, z) + 0.25
        pos.push(x + nx * o0, ym + l0, z + nz * o0, x + nx * o1, ym + l1, z + nz * o1)
        col.push(c0, c0, c0, c1, c1, c1)
        if (s > 0) { const o = start + (s - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2) }
      }
    }
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  sg.setIndex(idx); sg.computeVertexNormals()
  const streetMat = new THREE.MeshStandardMaterial({ color: GRID.paving, roughness: 0.9, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  patchPaving(streetMat, u)
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

  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[]) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, ms.length))
    im.count = ms.length
    ms.forEach((m, i) => im.setMatrixAt(i, m))
    return im
  }
  const walls = inst(unitBox(), mats.plaster, wallM)
  const roofs = [inst(unitGable(), mats.roofTile, roofM.gable), inst(unitHip(), mats.roofTile, roofM.hip), inst(unitShed(), mats.roofTile, roofM.shed)]
  const courts = inst(unitBox(), mats.travertine, courtM)
  const piers = inst(unitBox(), mats.plaster, pierM)
  // per-house colour variation: weathered terracotta of different firings, lime plaster of different ages
  const c = new THREE.Color(), roofTones = ['#c26a43', '#b45a38', '#a8613f', '#c97f55', '#9c5236', '#b8704a', '#a65a3e'].map((h) => new THREE.Color(h))
  for (const rm of roofs) for (let i = 0; i < rm.count; i++) {
    // instance colour multiplies the shared roof colour, so store tone / base
    const tone = roofTones[Math.floor(rand() * roofTones.length)], k = 0.9 + rand() * 0.16
    c.setRGB(tone.r / ROOF_BASE.r * k, tone.g / ROOF_BASE.g * k, tone.b / ROOF_BASE.b * k)
    rm.setColorAt(i, c)
  }
  // lime-washed walls, a few ochre and pinkish washes
  const washes = [[1, 0.97, 0.92], [1, 0.97, 0.92], [1, 0.97, 0.92], [1, 0.93, 0.82], [1, 0.92, 0.86], [0.97, 0.95, 0.9]]
  for (const im of [walls, piers]) for (let i = 0; i < im.count; i++) {
    const w = 0.86 + rand() * 0.16, ws = washes[Math.floor(rand() * washes.length)]
    im.setColorAt(i, c.setRGB(w * ws[0], w * ws[1], w * ws[2]))
  }
  for (let i = 0; i < courts.count; i++) courts.setColorAt(i, c.setScalar(0.92 + rand() * 0.08))
  for (const im of [walls, ...roofs, courts, piers]) {
    im.castShadow = im.receiveShadow = true; im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
  }
  courts.castShadow = false
  return { walls, roofs, courts, piers, streets, ruins, stats: { insulae, houses, streetKm: streetLen / 1000 } }
}

/** Paving slabs on the street ribbons, laid along the grid axis: staggered courses, joints with bump relief,
 * per-slab tint, wheel-worn centre. Fades out with distance and in plan mode. */
function patchPaving(m: THREE.MeshStandardMaterial, axis: V2) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPlan = sceneUniforms.uPlan
    sh.uniforms.uAxis = { value: new THREE.Vector2(axis[0], axis[1]) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uPlan;
uniform vec2 uAxis;
varying vec3 vPW;
float pBump = 0.0;
float ph21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 g = vec2(dot(vPW.xz, uAxis), dot(vPW.xz, vec2(uAxis.y, -uAxis.x)));
  vec2 uv = vec2(g.x / 1.25, g.y / 0.85);
  float row = floor(uv.y);
  uv.x += ph21(vec2(row, 1.3)) * 0.8;
  vec2 cell = floor(uv), f = fract(uv);
  float jd = min(min(f.x, 1.0 - f.x) * 1.25, min(f.y, 1.0 - f.y) * 0.85);
  float px = length(fwidth(vPW.xz));
  float fade = (1.0 - smoothstep(0.05, 0.25, px)) * (1.0 - uPlan);
  float joint = (1.0 - smoothstep(0.015, 0.015 + max(0.02, px * 1.5), jd)) * fade;
  diffuseColor.rgb *= 1.0 + (ph21(cell) - 0.5) * 0.16 * fade - joint * 0.3;
  pBump = (smoothstep(0.0, 0.12, jd) * 0.01 - joint * 0.015) * fade;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(pBump), dhy = dFdy(pBump);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
}`)
  }
  m.customProgramCacheKey = () => 'hier-paving'
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
      built.walls.dispose(); built.roofs.forEach((r) => r.dispose()); built.courts.dispose(); built.piers.dispose(); built.streets.geometry.dispose()
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
      {built.roofs.map((r, i) => <primitive key={i} object={r} />)}
      <primitive object={built.courts} />
      <primitive object={built.piers} />
      {built.ruins && <primitive object={built.ruins} />}
      {visible && mode !== 'plan' && labels.map((l, i) => (
        <Html key={l.en + l.lat} position={l.pos} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <span ref={(el) => { labelRefs.current[i] = el }} className="whitespace-nowrap rounded-full bg-black/45 px-2 py-0.5 font-serif text-[11px] italic text-travertine/90 backdrop-blur-sm">{l[lang]}</span>
        </Html>
      ))}
    </group>
  )
}
