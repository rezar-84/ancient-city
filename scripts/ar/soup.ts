/** Triangle-soup accumulator with per-vertex normals and UVs, plus helpers shared by the AR theatre build. */
import * as THREE from 'three'
import { TILE } from './textures.ts'

export type MatKey = 'limestone' | 'travertine' | 'marble' | 'paving'
export const MAT_KEYS: MatKey[] = ['limestone', 'travertine', 'marble', 'paving']
export type V3 = [number, number, number]
export type V2 = [number, number]

export class Soup {
  pos: number[] = []; nrm: number[] = []; uv: number[] = []
  get triCount() { return this.pos.length / 9 }
  /** add a triangle; winding is fixed up so the geometric normal agrees with the supplied normals */
  tri(a: V3, b: V3, c: V3, na: V3, nb: V3, nc: V3, ua: V2, ub: V2, uc: V2) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2]
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2]
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x
    const area = Math.hypot(fx, fy, fz)
    if (area < 1e-9) return
    const dot = fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2])
    if (dot < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [ub, uc] = [uc, ub] }
    this.pos.push(...a, ...b, ...c); this.nrm.push(...na, ...nb, ...nc); this.uv.push(...ua, ...ub, ...uc)
  }
  quad(a: V3, b: V3, c: V3, d: V3, na: V3, nb: V3, nc: V3, nd: V3, ua: V2, ub: V2, uc: V2, ud: V2) {
    this.tri(a, b, c, na, nb, nc, ua, ub, uc); this.tri(a, c, d, na, nc, nd, ua, uc, ud)
  }
}

export const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }

/** world-space box/planar projection for one face: floors use XZ, walls run along their horizontal tangent */
export function planarUV(p: V3, n: V3, tile = TILE): V2 {
  if (Math.abs(n[1]) > 0.7) return [p[0] / tile, p[2] / tile]
  const tl = Math.hypot(n[0], n[2]) || 1
  const tx = -n[2] / tl, tz = n[0] / tl
  return [(p[0] * tx + p[2] * tz) / tile, -p[1] / tile]
}

/** add any three.js geometry (already positioned) with planar UVs computed per face */
export function addGeometry(s: Soup, g: THREE.BufferGeometry, keepUV = false) {
  const geo = g.index ? g.toNonIndexed() : g
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal'), U = geo.getAttribute('uv')
  for (let i = 0; i < P.count; i += 3) {
    const v = [0, 1, 2].map((k) => [P.getX(i + k), P.getY(i + k), P.getZ(i + k)] as V3)
    const n = [0, 1, 2].map((k) => [N.getX(i + k), N.getY(i + k), N.getZ(i + k)] as V3)
    const fn = faceNormal(v[0], v[1], v[2])
    const uv = [0, 1, 2].map((k) => keepUV && U ? [U.getX(i + k), U.getY(i + k)] as V2 : planarUV(v[k], fn))
    s.tri(v[0], v[1], v[2], n[0], n[1], n[2], uv[0], uv[1], uv[2])
  }
}

export function faceNormal(a: V3, b: V3, c: V3): V3 {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]])
}
