import * as THREE from 'three';
import { getMaterials, combine, gable, matrix } from '../materials';
export interface NecropolisOptions { area?: { w: number; d: number }; seed?: number; tumuli?: number; sarcophagi?: number; houseTombs?: number }
export type TombType = 'tumulus' | 'sarcophagus' | 'houseTomb';
export interface TombPosition { type: TombType; x: number; z: number }
/** Deterministic mulberry32, returning values in [0,1). */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/** Seed 1, 400×300m area; 40 tumuli (r4–8), 250 sarcophagi (2.4×1.2×1.4m), 60 house tombs (4×6m).
 * Every type is instanced, including small counts, so individual tombs remain terrain-snappable.
 * Metadata is group.userData.instances: TombPosition[]. Each tomb includes a 3m buried foundation.
 */
export function createNecropolis(o: NecropolisOptions = {}): THREE.Group {
  const { area = { w: 400, d: 300 }, seed = 1, tumuli = 40, sarcophagi = 250, houseTombs = 60 } = o;
  const group = new THREE.Group(); group.name = 'Necropolis';
  const random = mulberry32(seed), positions: TombPosition[] = [];
  group.userData.instances = positions;
  const types: Array<{ type: TombType; count: number; radius: number; geometry: () => THREE.BufferGeometry }> = [
    { type: 'tumulus', count: tumuli, radius: 8, geometry: () => combine([
      new THREE.CylinderGeometry(1, 1, 4.5, 12).translate(0, -0.75, 0),
      new THREE.ConeGeometry(1, 3.5, 12).translate(0, 3.25, 0),
    ]) },
    { type: 'sarcophagus', count: sarcophagi, radius: 1.5, geometry: () => combine([
      new THREE.BoxGeometry(2.8, 3.3, 1.6).translate(0, -1.5, 0),
      new THREE.BoxGeometry(2.55, 0.22, 1.35).translate(0, 0.26, 0),
      new THREE.BoxGeometry(2.4, 1.3, 1.2).translate(0, 1.02, 0),
      // Tabula ansata inscription panel & corner lid acroteria
      new THREE.BoxGeometry(0.95, 0.55, 1.26).translate(0, 1.05, 0),
      gable(1.5, 0.45, 2.7).rotateY(Math.PI / 2).translate(0, 1.67, 0),
      new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(-1.2, 1.82, 0.64),
      new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(1.2, 1.82, 0.64),
      new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(-1.2, 1.82, -0.64),
      new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(1.2, 1.82, -0.64),
    ]) },
    { type: 'houseTomb', count: houseTombs, radius: 3.7, geometry: () => combine([
      // Foundation top at y = +0.16 with front threshold step so the 1.4×2.7 m chamber doorway is walkable!
      new THREE.BoxGeometry(4.2, 3.16, 6.2).translate(0, -1.42, 0),
      new THREE.BoxGeometry(2.0, 1.6, 0.55).translate(0, -0.82, 3.35),
      new THREE.BoxGeometry(0.4, 3.5, 6).translate(-1.8, 1.91, 0),
      new THREE.BoxGeometry(0.4, 3.5, 6).translate(1.8, 1.91, 0),
      new THREE.BoxGeometry(4, 3.5, 0.4).translate(0, 1.91, -2.8),
      new THREE.BoxGeometry(1.3, 3.5, 0.4).translate(-1.35, 1.91, 2.8),
      new THREE.BoxGeometry(1.3, 3.5, 0.4).translate(1.35, 1.91, 2.8),
      new THREE.BoxGeometry(1.4, 0.95, 0.4).translate(0, 3.18, 2.8),
      new THREE.BoxGeometry(1.9, 0.18, 0.54).translate(0, 2.75, 2.82),
      // Interior stone funerary klinai benches along side walls
      new THREE.BoxGeometry(0.68, 0.48, 3.8).translate(-1.26, 0.40, -0.4),
      new THREE.BoxGeometry(0.68, 0.48, 3.8).translate(1.26, 0.40, -0.4),
      gable(4.5, 1.3, 6.5).translate(0, 3.66, 0),
    ]) },
  ];
  const occupied: Array<{ x: number; z: number; r: number }> = [];
  for (const { type, count, radius, geometry } of types) {
    const n = Math.max(0, Math.floor(count)); if (!n) continue;
    const g = geometry();
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
    const mesh = new THREE.InstancedMesh(g, getMaterials().limestone, n);
    mesh.name = type; mesh.castShadow = mesh.receiveShadow = true;
    const indices: number[] = []; mesh.userData.tombIndices = indices;
    for (let i = 0; i < n; i++) {
      const r = type === 'tumulus' ? 4 + random() * 4 : radius;
      // Bounded rejection keeps ordinary layouts spacious without hanging on dense requested areas.
      let x = 0, z = 0;
      for (let attempt = 0; attempt < 80; attempt++) {
        x = (random() - 0.5) * Math.max(0, area.w - r * 2);
        z = (random() - 0.5) * Math.max(0, area.d - r * 2);
        if (occupied.every(p => Math.hypot(p.x - x, p.z - z) > p.r + r + 0.8)) break;
      }
      occupied.push({ x, z, r });
      indices.push(positions.length); positions.push({ type, x, z });
      mesh.setMatrixAt(i, matrix({ x, y: 0, z, ry: random() * Math.PI * 2,
        sx: type === 'tumulus' ? r : 1, sz: type === 'tumulus' ? r : 1 }));
      mesh.setColorAt(i, new THREE.Color().setScalar(0.91 + random() * 0.09));
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}
/** Sample world XZ using the supplied site origin. Heights are world Y; translation of the
 * group's ground datum is subtracted. Call again after terrain changes. Preserve all rotations/scales.
 * The group must retain its generated orientation and scale (translation is supported).
 */
export function snapToTerrain(group: THREE.Group, heightAt: (x: number, z: number) => number, origin: { x: number; z: number }) {
  const positions = group.userData.instances as TombPosition[] | undefined;
  if (!positions) return;
  group.updateWorldMatrix(true, false);
  const datum = group.getWorldPosition(new THREE.Vector3()).y, m = new THREE.Matrix4();
  group.traverse(child => {
    if (!(child instanceof THREE.InstancedMesh)) return;
    const indices = child.userData.tombIndices as number[] | undefined;
    if (!indices) return;
    indices.forEach((index, i) => {
      const p = positions[index], y = heightAt(origin.x + p.x, origin.z + p.z);
      if (!Number.isFinite(y)) return;
      child.getMatrixAt(i, m); m.elements[13] = y - datum; child.setMatrixAt(i, m);
    });
    child.instanceMatrix.needsUpdate = true;
    child.computeBoundingBox(); child.computeBoundingSphere();
  });
}
