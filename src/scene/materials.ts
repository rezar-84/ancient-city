import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function makeMaterials() {
  const stone = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, vertexColors: true });
  const bronze = stone('#5a4a3a');
  return {
    marble: stone('#efe8dc'), travertine: stone('#e6dccb'), limestone: stone('#d6c4a4'),
    roofTile: stone('#b5653f'), bronze, dark: bronze,
    water: new THREE.MeshStandardMaterial({ color: '#7fc8d6', transparent: true, opacity: 0.8, roughness: 0.1, vertexColors: true }),
    plaster: stone('#e9d9bf'), ground: stone('#cdb48e'),
  };
}
let cached: ReturnType<typeof makeMaterials> | undefined;
/** Cached shared materials; vertex colors multiply the base color for quiet stone variation. */
export function getMaterials() { return cached ??= makeMaterials(); }

export type MaterialKey = keyof ReturnType<typeof getMaterials>;
export type Placement = { x: number; y: number; z: number; ry?: number; sx?: number; sy?: number; sz?: number };
/** Owns temporary geometry and emits one merged mesh per material. */
export class Building {
  readonly group = new THREE.Group();
  private readonly parts = new Map<MaterialKey, THREE.BufferGeometry[]>();
  private serial = 0;
  constructor(name: string) { this.group.name = name; }
  add(key: MaterialKey, geometry: THREE.BufferGeometry, p: Placement = { x: 0, y: 0, z: 0 }) {
    geometry.applyMatrix4(matrix(p));
    paint(geometry, 0.96 + 0.04 * Math.sin(++this.serial * 2.399));
    const parts = this.parts.get(key) ?? [];
    parts.push(geometry); this.parts.set(key, parts);
  }
  box(key: MaterialKey, w: number, h: number, d: number, x = 0, y = h / 2, z = 0, ry = 0) {
    this.add(key, new THREE.BoxGeometry(w, h, d), { x, y, z, ry });
  }
  foundation(w: number, d: number) { this.box('limestone', w, 3.15, d, 0, -1.425); }
  repeated(key: MaterialKey, geometry: THREE.BufferGeometry, placements: Placement[]) {
    if (placements.length <= 50) {
      for (const p of placements) this.add(key, geometry.clone(), p);
    } else {
      paint(geometry, 1);
      const mesh = new THREE.InstancedMesh(geometry, getMaterials()[key], placements.length);
      placements.forEach((p, i) => {
        mesh.setMatrixAt(i, matrix(p));
        mesh.setColorAt(i, new THREE.Color().setScalar(0.94 + 0.06 * ((i * 0.618034) % 1)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    }
    geometry.dispose();
    return undefined;
  }
  finish() {
    for (const [key, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false);
      if (!geometry) throw new Error('Unable to merge ' + key);
      parts.forEach(p => p.dispose());
      const mesh = new THREE.Mesh(geometry, getMaterials()[key]);
      mesh.name = key; mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.parts.clear();
    return this.group;
  }
}
export function matrix(p: Placement) {
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry ?? 0),
    new THREE.Vector3(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1));
}
function paint(g: THREE.BufferGeometry, tint: number) {
  const n = g.getAttribute('position').count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(tint), 3));
  if (!g.getAttribute('aFlute')) flute(g, false);
}
/** aFlute marks fluted column shafts for the procedural stone shader: 0 = plain, 1 + u = angle round the shaft (0..1). */
function flute(g: THREE.BufferGeometry, on: boolean) {
  const n = g.getAttribute('position').count, a = new Float32Array(n), uv = g.getAttribute('uv');
  if (on && uv) for (let i = 0; i < n; i++) a[i] = 1 + uv.getX(i);
  g.setAttribute('aFlute', new THREE.BufferAttribute(a, 1));
  return g;
}
export function combine(parts: THREE.BufferGeometry[]) {
  const normalized = parts.map(g => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(normalized, false);
  new Set([...parts, ...normalized]).forEach(g => g.dispose());
  if (!result) throw new Error('Unable to combine geometry');
  result.setIndex(Array.from({ length: result.getAttribute('position').count }, (_, i) => i));
  return result;
}
/** Column with square plinth, torus base, fluted shaft (entasis taper), echinus and abacus; total height = height. */
export function column(height = 6, radius = 0.35) {
  const seg = 12, r = radius, plinth = 0.22, torus = 0.2, echinus = 0.26, abacus = 0.2;
  const shaft = Math.max(0.5, height - plinth - torus - echinus - abacus);
  const y1 = plinth + torus, y2 = y1 + shaft;
  return combine([
    flute(new THREE.BoxGeometry(r * 2.7, plinth, r * 2.7).translate(0, plinth / 2, 0), false),
    flute(new THREE.CylinderGeometry(r * 1.12, r * 1.28, torus, 8, 1, true).translate(0, plinth + torus / 2, 0), false),
    flute(new THREE.CylinderGeometry(r * 0.86, r, shaft, seg, 1, true).translate(0, y1 + shaft / 2, 0), true),
    flute(new THREE.CylinderGeometry(r * 1.3, r * 0.88, echinus, 8, 1, true).translate(0, y2 + echinus / 2, 0), false),
    flute(new THREE.BoxGeometry(r * 2.8, abacus, r * 2.8).translate(0, height - abacus / 2, 0), false),
  ]);
}
/** Open arch, ten intrados segments. Height is the total clear height. */
export function arch(width: number, height: number, depth: number, pier = 0.8) {
  const r = width / 2, spring = height - r;
  const shape = new THREE.Shape();
  shape.moveTo(-r - pier, 0); shape.lineTo(-r - pier, height + pier);
  shape.lineTo(r + pier, height + pier); shape.lineTo(r + pier, 0);
  shape.lineTo(r, 0); shape.lineTo(r, spring);
  for (let i = 1; i <= 10; i++) {
    const a = i * Math.PI / 10; shape.lineTo(r * Math.cos(a), spring + r * Math.sin(a));
  }
  shape.lineTo(-r, 0); shape.closePath();
  return combine([new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }).translate(0, 0, -depth / 2)]);
}
/** Triangular prism with ridge along local Z. */
export function gable(w: number, rise: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, rise); s.closePath();
  return combine([new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)]);
}
/** Ring sector in XZ; angles measured from +Z. */
export function sector(inner: number, outer: number, h: number, start: number, sweep: number, segments = 40) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = start + sweep * i / segments;
    const x = outer * Math.sin(a), z = outer * Math.cos(a);
    if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
  }
  for (let i = segments; i >= 0; i--) {
    const a = start + sweep * i / segments; shape.lineTo(inner * Math.sin(a), -inner * Math.cos(a));
  }
  shape.closePath();
  return combine([new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2)]);
}
