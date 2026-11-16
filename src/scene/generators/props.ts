import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MaterialKey } from '../materials';

export interface PropParts { parts: Array<{ key: MaterialKey; geometry: THREE.BufferGeometry }> }
class Parts {
  private groups = new Map<MaterialKey, THREE.BufferGeometry[]>();
  add(key: MaterialKey, source: THREE.BufferGeometry, color = '#ffffff') {
    const g = source.index ? source.toNonIndexed() : source;
    if (g !== source) source.dispose();
    const c = new THREE.Color(color), colors = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const list = this.groups.get(key) ?? []; list.push(g); this.groups.set(key, list);
  }
  box(key: MaterialKey, w: number, h: number, d: number, x: number, y: number, z: number, color?: string) {
    this.add(key, new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);
  }
  finish(): PropParts {
    return { parts: Array.from(this.groups, ([key, gs]) => {
      const geometry = mergeGeometries(gs, false); gs.forEach(g => g.dispose());
      if (!geometry) throw new Error(`Cannot merge ${key}`);
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return { key, geometry };
    }) };
  }
}
// Shared eight-sided vessel with a flared lip and solid loop handles.
function amphora() {
  const body = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.22, 0.32),
    new THREE.Vector2(0.085, 0.58), new THREE.Vector2(0.12, 0.68),
  ], 8);
  const handles = [-1, 1].map(s => new THREE.TorusGeometry(0.095, 0.018, 4, 8).scale(0.75, 1.2, 1).translate(s * 0.15, 0.49, 0));
  const pieces = [body, ...handles].map(g => { const flat = g.toNonIndexed(); g.dispose(); return flat; });
  const result = mergeGeometries(pieces, false)!;
  pieces.forEach(g => g.dispose()); return result;
}
export function marketStall(variant: 0 | 1 | 2): PropParts {
  const p = new Parts();
  for (const x of [-1.22, 1.22]) for (const z of [-0.82, 0.82]) {
    const h = z < 0 ? 2.3 : 2.05; p.box('ground', 0.12, h, 0.12, x, h / 2, z, '#705038');
  }
  p.box('ground', 2.6, 0.12, 0.12, 0, 2.24, -0.82, '#705038');
  p.box('ground', 2.45, 0.85, 0.6, 0, 0.425, 0.5, '#906b46');
  p.add('plaster', new THREE.PlaneGeometry(2.6, 1.82).rotateX(-Math.PI / 2).rotateX(-0.14).translate(0, 2.17, 0));
  // Awning hems and counter planks add readable close-range structure.
  for (let i = 0; i < 7; i++) {
    p.box('plaster', 0.36, 0.16, 0.035, -1.08 + i * 0.36, 1.99, 0.9, i % 2 ? '#a8664b' : '#e2cfaa');
    p.box('ground', 0.32, 0.035, 0.63, -1.02 + i * 0.34, 0.87, 0.5, i % 2 ? '#866442' : '#a67c50');
  }
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.68;
    if (variant === 0) {
      p.box('plaster', 0.58, 0.22, 0.48, x, 0.96, 0.5, i % 2 ? '#942f39' : '#683f83');
      p.box('plaster', 0.5, 0.13, 0.42, x, 1.135, 0.5, i % 2 ? '#683f83' : '#942f39');
    } else if (variant === 1) p.add('roofTile', amphora().translate(x, 0.85, 0.5));
    else {
      p.add('ground', new THREE.CylinderGeometry(0.26, 0.19, 0.24, 4, 1, true).translate(x, 0.97, 0.5), '#967447');
      p.add('plaster', new THREE.OctahedronGeometry(0.24).scale(1, 0.6, 1).translate(x, 1.12, 0.5), i % 2 ? '#ae4933' : '#829443');
    }
  }
  return p.finish();
}
export function amphoraStack(): PropParts {
  const p = new Parts(); p.box('ground', 2.1, 0.15, 0.45, 0, 0.2, 0, '#705038');
  for (let i = 0; i < 5; i++) p.add('roofTile', amphora().rotateZ((i % 2 ? -1 : 1) * 0.18).translate((i - 2) * 0.4, 0.05, 0));
  return p.finish();
}
export function bench(): PropParts {
  const p = new Parts(); p.box('limestone', 1.8, 0.16, 0.52, 0, 0.49, 0);
  for (const x of [-0.62, 0.62]) p.box('limestone', 0.22, 0.41, 0.43, x, 0.205, 0);
  return p.finish();
}
export function statueOnPedestal(): PropParts {
  const p = new Parts(); p.box('marble', 0.9, 1.4, 0.9, 0, 0.7, 0);
  // Shallow dark grooves evoke inscription lines on the front face.
  for (let i = 0; i < 3; i++) p.box('dark', 0.5 - i * 0.06, 0.015, 0.004, 0, 0.95 - i * 0.1, 0.452);
  p.add('marble', new THREE.CylinderGeometry(0.23, 0.34, 1.35, 5).translate(0, 2.075, 0));
  p.add('marble', new THREE.OctahedronGeometry(0.22).scale(0.8, 1.25, 0.9).translate(0, 3.025, 0));
  for (const x of [-0.28, 0.28]) p.box('marble', 0.14, 0.85, 0.18, x, 2.25, 0);
  return p.finish();
}
export function altar(): PropParts {
  const p = new Parts();
  p.box('limestone', 1.1, 0.15, 0.9, 0, 0.075, 0);
  p.box('limestone', 0.8, 0.65, 0.65, 0, 0.475, 0);
  p.box('limestone', 1, 0.13, 0.85, 0, 0.865, 0);
  for (const x of [-0.4, 0.4]) for (const z of [-0.32, 0.32]) p.add('limestone', new THREE.ConeGeometry(0.12, 0.22, 4).translate(x, 1.04, z));
  return p.finish();
}
export function streetFountain(): PropParts {
  const p = new Parts(); p.box('limestone', 1.6, 0.12, 1.6, 0, 0.06, 0);
  for (const x of [-0.7, 0.7]) p.box('limestone', 0.2, 0.5, 1.6, x, 0.25, 0);
  for (const z of [-0.7, 0.7]) p.box('limestone', 1.2, 0.5, 0.2, 0, 0.25, z);
  p.box('limestone', 0.4, 1.5, 0.24, 0, 0.75, -0.65);
  p.box('limestone', 0.14, 0.12, 0.32, 0, 1.04, -0.4);
  p.add('water', new THREE.PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2).translate(0, 0.35, 0));
  return p.finish();
}
export function milestone(): PropParts {
  const p = new Parts(); p.add('limestone', new THREE.CylinderGeometry(0.23, 0.27, 1.2, 8).translate(0, 0.6, 0));
  p.add('plaster', new THREE.CylinderGeometry(0.245, 0.25, 0.22, 8, 1, true).translate(0, 0.84, 0), '#9c927e');
  return p.finish();
}
export function lampPost(): PropParts {
  const p = new Parts(); p.box('limestone', 0.4, 0.16, 0.4, 0, 0.08, 0);
  p.add('bronze', new THREE.CylinderGeometry(0.045, 0.075, 2.25, 6).translate(0, 1.285, 0));
  p.box('bronze', 0.08, 0.08, 0.48, 0, 2.34, 0.2);
  p.add('bronze', new THREE.CylinderGeometry(0.19, 0.12, 0.24, 6, 1, true).translate(0, 2.13, 0.4));
  p.add('bronze', new THREE.ConeGeometry(0.24, 0.15, 6).translate(0, 2.4, 0.4));
  return p.finish();
}
export function parkedCart(): PropParts {
  const p = new Parts(); p.box('ground', 1.2, 0.18, 1.65, 0, 0.66, 0, '#705038');
  for (const x of [-0.56, 0.56]) p.box('ground', 0.08, 0.45, 1.65, x, 0.96, 0, '#906b46');
  p.box('ground', 1.2, 0.45, 0.08, 0, 0.96, -0.79, '#906b46');
  for (const x of [-0.72, 0.72]) p.add('ground', new THREE.CylinderGeometry(0.45, 0.45, 0.12, 8).rotateZ(Math.PI / 2).translate(x, 0.45, 0), '#705038');
  for (const x of [-0.42, 0.42]) p.box('ground', 0.07, 0.07, 1.5, x, 0.66, 1.5, '#705038');
  p.box('plaster', 0.94, 0.5, 1.25, 0, 0.99, 0, '#b9a078'); return p.finish();
}
