/** Vertex welding, hemisphere-raycast ambient occlusion (three-mesh-bvh), hidden-face culling and
 * a ground-dirt term, baked into per-vertex colours. */
import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { Soup, MatKey } from './soup.ts'

export interface Baked {
  key: MatKey
  pos: Float32Array; nrm: Float32Array; uv: Float32Array
  color: Float32Array // linear RGB multiplier (AO x dirt)
  index: Uint32Array
}

function weld(s: Soup) {
  const map = new Map<string, number>()
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], index: number[] = []
  const n = s.pos.length / 3
  for (let i = 0; i < n; i++) {
    const p = s.pos.slice(i * 3, i * 3 + 3), q = s.nrm.slice(i * 3, i * 3 + 3), t = s.uv.slice(i * 2, i * 2 + 2)
    const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)},${Math.round(q[0] * 500)},${Math.round(q[1] * 500)},${Math.round(q[2] * 500)},${Math.round(t[0] * 2e4)},${Math.round(t[1] * 2e4)}`
    let id = map.get(key)
    if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(...p); nrm.push(...q); uv.push(...t) }
    index.push(id)
  }
  return { pos, nrm, uv, index }
}

/** low-discrepancy cosine-weighted hemisphere directions (local frame, z = normal) */
function hemisphere(n: number) {
  const out: [number, number, number][] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, r = Math.sqrt(u), phi = i * golden
    out.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)])
  }
  return out
}

/** smooth 3D value noise in world space (breaks up texture tiling on large walls) */
function h3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const f = (t: number) => t * t * (3 - 2 * t)
  const fx = f(x - xi), fy = f(y - yi), fz = f(z - zi)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => h3(xi + dx, yi + dy, zi + dz)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz)
}

export function bakeAll(soups: Record<MatKey, Soup>, opts = { rays: 48, maxDist: 7 }) {
  const welded = (Object.keys(soups) as MatKey[]).map((key) => ({ key, ...weld(soups[key]) }))
  // one BVH over everything so materials occlude each other
  const allPos: number[] = [], allIdx: number[] = []
  for (const w of welded) {
    const base = allPos.length / 3
    for (const x of w.pos) allPos.push(x)
    for (const i of w.index) allIdx.push(base + i)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3))
  geo.setIndex(allIdx)
  const bvh = new MeshBVH(geo, { maxLeafTris: 8 })
  const dirs = hemisphere(opts.rays)
  const ray = new THREE.Ray()
  const t = new THREE.Vector3(), b = new THREE.Vector3(), nrm = new THREE.Vector3(), up = new THREE.Vector3()

  const out: Baked[] = []
  let culled = 0
  for (const w of welded) {
    const nv = w.pos.length / 3
    const ao = new Float32Array(nv), enclosed = new Uint8Array(nv)
    for (let v = 0; v < nv; v++) {
      nrm.set(w.nrm[v * 3], w.nrm[v * 3 + 1], w.nrm[v * 3 + 2]).normalize()
      up.set(Math.abs(nrm.y) < 0.9 ? 0 : 1, Math.abs(nrm.y) < 0.9 ? 1 : 0, 0)
      t.crossVectors(up, nrm).normalize(); b.crossVectors(nrm, t)
      // rotate the sample pattern per vertex to trade banding for fine noise
      const rot = ((v * 0.618034) % 1) * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot)
      let occ = 0, near = 0
      for (const [x0, y0, z] of dirs) {
        const x = x0 * cr - y0 * sr, y = x0 * sr + y0 * cr
        ray.direction.set(t.x * x + b.x * y + nrm.x * z, t.y * x + b.y * y + nrm.y * z, t.z * x + b.z * y + nrm.z * z)
        ray.origin.set(w.pos[v * 3] + nrm.x * 0.02, w.pos[v * 3 + 1] + nrm.y * 0.02, w.pos[v * 3 + 2] + nrm.z * 0.02)
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, opts.maxDist)
        if (hit) {
          occ += Math.sqrt(1 - hit.distance / opts.maxDist)
          if (hit.distance < 0.25) near++
        }
      }
      ao[v] = 1 - occ / dirs.length
      enclosed[v] = near / dirs.length > 0.93 ? 1 : 0
    }
    // drop faces that are completely buried inside other geometry
    const keep: number[] = []
    for (let i = 0; i < w.index.length; i += 3) {
      const a = w.index[i], bb = w.index[i + 1], c = w.index[i + 2]
      if (enclosed[a] && enclosed[bb] && enclosed[c]) { culled++; continue }
      keep.push(a, bb, c)
    }
    // compact vertices
    const remap = new Int32Array(nv).fill(-1)
    const P: number[] = [], N: number[] = [], U: number[] = [], C: number[] = [], I: number[] = []
    for (const i of keep) {
      if (remap[i] < 0) {
        remap[i] = P.length / 3
        P.push(w.pos[i * 3], w.pos[i * 3 + 1], w.pos[i * 3 + 2]); N.push(w.nrm[i * 3], w.nrm[i * 3 + 1], w.nrm[i * 3 + 2]); U.push(w.uv[i * 2], w.uv[i * 2 + 1])
        // contrast curve, a warm bounce tint in the darks, and soil/damp darkening near the ground on walls
        const a = Math.pow(Math.min(1, Math.max(0, ao[i])), 1.25)
        const y = w.pos[i * 3 + 1], vert = 1 - Math.abs(w.nrm[i * 3 + 1])
        const dirt = 1 - 0.16 * vert * (1 - Math.min(1, Math.max(0, y / 2.5))) - 0.05 * (1 - Math.min(1, Math.max(0, y / 6)))
        // large-scale weathering patches and a faint warm/cool drift, so the 4 m texture repeat doesn't read
        const px = w.pos[i * 3], pz = w.pos[i * 3 + 2]
        const big = noise3(px / 9, y / 7, pz / 9), mid = noise3(px / 3.1 + 17, y / 2.3, pz / 3.1), hue = noise3(px / 14 + 5, y / 10, pz / 14)
        const vary = 1 + (big - 0.5) * 0.26 + (mid - 0.5) * 0.1
        const k = Math.max(0.18, a) * dirt * vary
        C.push(k * (1 + (hue - 0.5) * 0.06), k * (0.975 + 0.025 * k), k * (0.94 + 0.06 * k) * (1 - (hue - 0.5) * 0.06))
      }
      I.push(remap[i])
    }
    out.push({ key: w.key, pos: new Float32Array(P), nrm: new Float32Array(N), uv: new Float32Array(U), color: new Float32Array(C), index: new Uint32Array(I) })
  }
  return { meshes: out, culled }
}
