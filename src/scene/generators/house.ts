import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Building, column, gable, matrix } from '../materials';
import type { MaterialKey } from '../materials';

type Part = { key: MaterialKey; geometry: THREE.BufferGeometry };
function box(w: number, h: number, d: number, x = 0, y = h / 2, z = d / 2) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}
/** All public standalone geometries are non-indexed and have white vertex colours. */
function merge(parts: THREE.BufferGeometry[]) {
  const normalized = parts.map(g => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(normalized, false);
  new Set([...parts, ...normalized]).forEach(g => g.dispose());
  if (!result) throw new Error('Unable to merge house geometry');
  result.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(result.getAttribute('position').count * 3).fill(1), 3));
  return result;
}
function part(key: MaterialKey, ...parts: THREE.BufferGeometry[]): Part {
  return { key, geometry: merge(parts) };
}

/** Shared metre-sized assets, bottom-centred on the wall plane, outward = +Z.
 * Openings are shallow dark overlays: no wall booleans are required for instancing.
 * Counts include every material part and stay at or below 60 triangles per module.
 */
export const FACADE_MODULES: Record<string, Array<{ key: MaterialKey; geometry: THREE.BufferGeometry }>> = {
  door: [part('dark', box(1.1, 2.2, 0.008)), part('limestone',
    box(0.16, 2.2, 0.25, -0.63), box(0.16, 2.2, 0.25, 0.63), box(1.42, 0.18, 0.25, 0, 2.29))],
  window: [part('dark', box(0.6, 0.8, 0.008)), part('limestone',
    box(0.1, 0.8, 0.16, -0.35), box(0.1, 0.8, 0.16, 0.35),
    box(0.86, 0.12, 0.2, 0, 0.86), box(0.86, 0.12, 0.24, 0, 0.06))],
  shopFront: [part('dark', box(2.6, 2.6, 0.008)), part('limestone',
    box(0.22, 2.6, 0.25, -1.41), box(0.22, 2.6, 0.25, 1.41), box(3.04, 0.3, 0.32, 0, 2.75)),
    part('bronze', box(1.3, 2.48, 0.08, 0, 1.24, 0).rotateY(-Math.PI / 3).translate(-0.975, 0, 0.64))],
  stringCourse: [part('limestone', box(1, 0.12, 0.12), box(1, 0.06, 0.2, 0, 0.15))],
  eave: [part('limestone', box(1, 0.12, 0.2), box(1, 0.12, 0.36, 0, 0.18), box(1, 0.08, 0.48, 0, 0.28))],
  balcony: [part('bronze', box(2, 0.14, 0.95), box(2, 0.65, 0.09, 0, 0.465, 0.905),
    box(0.1, 0.65, 0.9, -0.95, 0.465), box(0.12, 0.6, 0.72, -0.7, -0.23), box(0.12, 0.6, 0.72, 0.7, -0.23))],
};

export interface FacadeWing {
  x: number; z: number; yaw: number; length: number; width: number; height: number; base: number;
  storeys: 1 | 2; front: 'u+' | 'u-' | 'v+' | 'v-'; shop: boolean;
}
/** Build-time only. `front` selects one street-facing wall; local +Z runs along u. */
export function layoutFacade(wing: FacadeWing, rand: () => number): Array<{ module: string; matrix: THREE.Matrix4 }> {
  const out: Array<{ module: string; matrix: THREE.Matrix4 }> = [];
  const { length, width, height, front } = wing;
  if (![length, width, height, wing.x, wing.z, wing.yaw, wing.base].every(Number.isFinite) || Math.min(length, width, height) <= 0) return out;
  const alongU = front[0] === 'u';
  const span = alongU ? width : length;
  const angle = front === 'u+' ? 0 : front === 'u-' ? Math.PI : front === 'v+' ? Math.PI / 2 : -Math.PI / 2;
  const depth = (alongU ? length : width) / 2 + 0.02;
  const sin = Math.sin(wing.yaw), cos = Math.cos(wing.yaw);
  const emit = (module: string, x: number, y: number, sx = 1) => {
    const lx = Math.cos(angle) * x + Math.sin(angle) * depth;
    const lz = -Math.sin(angle) * x + Math.cos(angle) * depth;
    out.push({ module, matrix: matrix({ x: wing.x + cos * lx + sin * lz, y: wing.base + y,
      z: wing.z - sin * lx + cos * lz, ry: wing.yaw + angle, sx }) });
  };
  const floor = height / wing.storeys;
  const opening = wing.shop ? 'shopFront' : 'door';
  const half = wing.shop ? 1.52 : 0.71;
  const usable = span - 0.8;
  const spacing = 6 + 3 * rand();
  const n = usable >= 2 * half ? Math.max(1, Math.floor(usable / spacing)) : 0;
  if (floor >= (wing.shop ? 2.9 : 2.38)) for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * usable / n;
    emit(opening, x, 0);
  }
  // Sparse, high-set windows, offset from entrances. Never cross a floor band or eave.
  const wy = wing.storeys === 2 ? floor + Math.max(0.7, (floor - 0.92) * 0.55) : Math.max(2.6, height - 1.5);
  const wn = Math.floor((span - 1) / 4.5);
  if (wy + 0.92 < height - 0.4) for (let i = 0; i < wn; i++) {
    if (rand() < 0.45) emit('window', (i - (wn - 1) / 2) * 4.5, wy);
  }
  // Scale only the final repeat so short wings and fractional metres stay inside corners.
  const bandLength = Math.max(0, span - 0.4);
  for (let start = -bandLength / 2; start < bandLength / 2 - 1e-6; start += 1) {
    const size = Math.min(1, bandLength / 2 - start);
    if (height >= 0.32) emit('eave', start + size / 2, height - 0.32, size);
    if (wing.storeys === 2) emit('stringCourse', start + size / 2, floor - 0.09, size);
  }
  if (wing.storeys === 2 && span >= 3 && floor >= 3 && rand() < 0.25) emit('balcony', 0, floor + 0.2);
  return out;
}

/** Courtyard axes: width X, depth Z. Column matrices assume column(colH, 0.18). */
export function peristyle(courtW: number, courtD: number, colH = 3.2) {
  if (![courtW, courtD, colH].every(Number.isFinite) || courtW < 2.4 || courtD < 1.8 || colH <= 0) {
    throw new RangeError('Peristyle requires width >= 2.4m, depth >= 1.8m and positive column height');
  }
  const columns: THREE.Matrix4[] = [];
  const w = courtW - 0.6, d = courtD - 0.6;
  const nx = Math.max(1, Math.round(w / 2.6)), nz = Math.max(1, Math.round(d / 2.6));
  for (const s of [-1, 1]) {
    for (let i = 0; i <= nx; i++) columns.push(matrix({ x: -w / 2 + w * i / nx, y: 0, z: s * d / 2 }));
    for (let i = 1; i < nz; i++) columns.push(matrix({ x: s * w / 2, y: 0, z: -d / 2 + d * i / nz }));
  }
  const gutter = merge([box(courtW, 0.14, 0.16, 0, 0.07, -courtD / 2 + 0.08),
    box(courtW, 0.14, 0.16, 0, 0.07, courtD / 2 - 0.08),
    box(0.16, 0.14, courtD - 0.32, -courtW / 2 + 0.08, 0.07, 0),
    box(0.16, 0.14, courtD - 0.32, courtW / 2 - 0.08, 0.07, 0)]);
  const basin = merge([box(1.6, 0.08, 1, 0, 0.04, 0), box(1.6, 0.18, 0.12, 0, 0.17, -0.44),
    box(1.6, 0.18, 0.12, 0, 0.17, 0.44), box(0.12, 0.18, 0.76, -0.74, 0.17, 0), box(0.12, 0.18, 0.76, 0.74, 0.17, 0)]);
  return { columns, gutter, basin };
}

/** Decorative replacement front, +Z outward, y=0 at stage floor.
 * Existing theatre faces -Z: rotate this group by PI and put it at
 * (0, 1.5, max(13, outerRadius * .3) - stageDepth / 2 - .71).
 * For a replacement use stageWidth/stageHeight (existing defaults 70/20).
 * Overlay retains the existing wall behind the shallow simulated openings.
 */
export function theatreScaenaeDetail(width = 90, height = 28): THREE.Group {
  if (![width, height].every(Number.isFinite) || width < 30 || height < 12) throw new RangeError('Scaenae requires width >= 30m and height >= 12m');
  const b = new Building('Scaenae frons detail');
  const tierH = height / 3, bay = width / 9;
  // Building merges indexed geometries; give custom extrusions a sequential index too.
  const add = (key: MaterialKey, g: THREE.BufferGeometry, x: number, y: number, z: number) => {
    if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
    b.add(key, g, { x, y, z });
  };
  for (let tier = 0; tier < 3; tier++) {
    const y = tier * tierH, ch = tierH * 0.65;
    b.box('limestone', width, 0.25, 0.6, 0, y + 0.125, 0.3);
    b.box('marble', width + 0.4, 0.26, 0.9, 0, y + tierH - 0.13, 0.45);
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * bay;
      const bw = bay * 0.72;
      b.box('limestone', bw, 0.45, 1.1, x, y + 0.225, 0.55);
      for (const s of [-1, 1]) add('marble', column(ch, Math.min(0.34, bay * 0.045)), x + s * bw * 0.4, y + 0.45, 0.8);
      b.box('marble', bw + 0.3, 0.25, 1.3, x, y + ch + 0.575, 0.65);
      b.box('limestone', bw, 0.22, 1.1, x, y + ch + 0.81, 0.55);
      const py = y + ch + 0.92, rise = tierH * 0.16;
      if ((i + tier) % 2 === 0) add('marble', gable(bw + 0.4, rise, 0.4), x, py, 0.9);
      else {
        const shape = new THREE.Shape();
        shape.moveTo(-bw / 2, 0);
        for (let j = 0; j <= 8; j++) {
          const a = Math.PI - j * Math.PI / 8;
          shape.lineTo(Math.cos(a) * bw / 2, Math.sin(a) * rise);
        }
        shape.lineTo(-bw / 2, 0);
        add('marble', new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false }), x, py, 0.7);
      }
      // Five ground-floor door bays; remaining bays contain shallow niches and statues.
      if (tier === 0 && i % 2 === 0) {
        const dw = bay * (i === 4 ? 0.44 : 0.3), dh = ch * (i === 4 ? 0.95 : 0.78);
        b.box('limestone', dw, dh, 0.015, x, dh / 2, 0.02);
        for (const s of [-1, 1]) b.box('marble', 0.16, dh, 0.22, x + s * (dw / 2 + 0.08), dh / 2, 0.13);
        b.box('marble', dw + 0.48, 0.24, 0.28, x, dh + 0.12, 0.16);
      } else {
        const sh = Math.min(2.2, ch * 0.5);
        // Darkened stone niche, still using only marble/limestone shared materials.
        const niche = box(bw * 0.5, ch * 0.85, 0.02, 0, ch * 0.425, 0);
        // Building paints its own variation; recess tint is applied after finish below.
        add('limestone', niche, x, y + 0.45, 0.035);
        b.box('marble', 0.8, 0.25, 0.65, x, y + 0.575, 0.46);
        add('marble', new THREE.CylinderGeometry(sh * 0.11, sh * 0.2, sh * 0.7, 7, 1), x, y + 0.7 + sh * 0.35, 0.48);
        add('marble', new THREE.IcosahedronGeometry(sh * 0.115, 0), x, y + 0.7 + sh * 0.85, 0.48);
        for (const s of [-1, 1]) add('marble', new THREE.CylinderGeometry(sh * 0.055, sh * 0.07, sh * 0.48, 5), x + s * sh * 0.15, y + 0.7 + sh * 0.47, 0.5);
      }
    }
  }
  const group = b.finish();
  // Recess panels are identifiable by their tiny depth, without extra materials/draw calls.
  for (const child of group.children) if (child instanceof THREE.Mesh && child.name === 'limestone') {
    const p = child.geometry.getAttribute('position'), c = child.geometry.getAttribute('color');
    for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0.06) c.setXYZ(i, 0.3, 0.3, 0.3);
    c.needsUpdate = true;
  }
  return group;
}
