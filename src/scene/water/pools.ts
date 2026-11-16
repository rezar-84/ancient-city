import * as THREE from 'three';
import { Building, column, combine } from '../materials';
import type { Terrain } from '../terrainData';
import { createWaterMaterial } from './material';
import { waterUniforms } from './ripples';
export interface WaterVolume {
  id: string; kind: 'pool' | 'terrace' | 'basin'; polygon: [number, number][];
  surfaceY: number; floorY: number;
}
type Floor = { positions: number[]; indices: number[] };
const floors = new WeakMap<WaterVolume, Floor>();
const grids = new WeakMap<WaterVolume[], Map<number, Map<number, WaterVolume[]>>>();
const CELL = 16;
function contains(p: [number, number][], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j], [bx, bz] = p[i];
    const cross = (x - ax) * (bz - az) - (z - az) * (bx - ax);
    if (Math.abs(cross) < 1e-7 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && z >= Math.min(az, bz) && z <= Math.max(az, bz)) return true;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
function floorAt(v: WaterVolume, x: number, z: number) {
  const f = floors.get(v);
  if (!f) return v.floorY;
  for (let i = 0; i < f.indices.length; i += 3) {
    const a = f.indices[i] * 3, b = f.indices[i + 1] * 3, c = f.indices[i + 2] * 3, p = f.positions;
    const den = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
    if (Math.abs(den) < 1e-10) continue;
    const u = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / den;
    const w = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / den;
    if (u >= -1e-7 && w >= -1e-7 && u + w <= 1 + 1e-7) return u * p[a + 1] + w * p[b + 1] + (1 - u - w) * p[c + 1];
  }
  return v.floorY;
}
/** Volumes/polygons are immutable after the first query; highest overlapping surface wins. */
export function waterAt(volumes: WaterVolume[], x: number, z: number): { surface: number; depth: number; kind: WaterVolume['kind'] } | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let grid = grids.get(volumes);
  if (!grid) {
    grid = new Map();
    for (const v of volumes) {
      const xs = v.polygon.map(p => p[0]), zs = v.polygon.map(p => p[1]);
      for (let gx = Math.floor(Math.min(...xs) / CELL); gx <= Math.floor(Math.max(...xs) / CELL); gx++) {
        let row = grid.get(gx); if (!row) { row = new Map(); grid.set(gx, row); }
        for (let gz = Math.floor(Math.min(...zs) / CELL); gz <= Math.floor(Math.max(...zs) / CELL); gz++) {
          const bucket = row.get(gz) ?? []; bucket.push(v); row.set(gz, bucket);
        }
      }
    }
    grids.set(volumes, grid);
  }
  const bucket = grid.get(Math.floor(x / CELL))?.get(Math.floor(z / CELL));
  let best: WaterVolume | undefined;
  if (bucket) for (const v of bucket) if ((!best || v.surfaceY > best.surfaceY) && contains(v.polygon, x, z)) best = v;
  return best ? { surface: best.surfaceY, depth: Math.max(0, best.surfaceY - floorAt(best, x, z)), kind: best.kind } : null;
}
function polygon(cx: number, cz: number, rx: number, rz: number, phase: number): [number, number][] {
  return Array.from({ length: 48 }, (_, i) => {
    const a = i * Math.PI * 2 / 48, lobe = 1 + 0.055 * Math.sin(a * 5 + phase) + 0.025 * Math.cos(a * 3);
    return [cx + Math.cos(a) * rx * lobe, cz + Math.sin(a) * rz * lobe];
  });
}
function geometry(p: number[], idx: number[], uv: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Radial mesh has closely paired rings at entry steps, with depth shared by floor and water. */
function basin(v: WaterVolume, cx: number, cz: number, depth: number, stone: Building, skirtY = v.floorY - 0.15) {
  const p: number[] = [], fp: number[] = [], uv: number[] = [], depths: number[] = [], idx: number[] = [];
  const rings = v.kind === 'pool' ? [0, 0.25, 0.5, 0.65, 0.651, 0.78, 0.781, 0.9, 0.901, 0.97, 1] : [0, 0.5, 0.9, 0.97, 1];
  const n = v.polygon.length;
  rings.forEach((r, k) => v.polygon.forEach(([ex, ez], j) => {
    const x = cx + (ex - cx) * r, z = cz + (ez - cz) * r;
    let d = depth * (1 - 0.18 * r * r);
    if (v.kind === 'pool' && ex > cx + 8 && Math.abs(ez - cz) < 6) d = r > 0.9 ? 0.4 : r > 0.78 ? 0.8 : r > 0.65 ? 1.2 : d;
    if (r > 0.97) d = 0.025;
    p.push(x, v.surfaceY, z); fp.push(x, v.surfaceY - d, z); depths.push(d); uv.push((x - cx) / 30, (z - cz) / 30);
    if (k) { const a = (k - 1) * n + j, b = (k - 1) * n + (j + 1) % n, c = k * n + j, e = k * n + (j + 1) % n; idx.push(a, b, c, b, e, c); }
  }));
  const g = geometry(p, idx, uv); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
  floors.set(v, { positions: fp, indices: idx });
  stone.add('travertine', geometry(fp, idx, uv));
  // Continuous curved coping, outer skirt down to the basin floor.
  const rp: number[] = [], ri: number[] = [], ru: number[] = [];
  v.polygon.forEach(([x, z], i) => {
    for (const [r, y] of [[1, v.surfaceY - 0.025], [1.025, v.surfaceY + 0.12], [1.065, v.surfaceY + 0.1], [1.065, skirtY]]) {
      rp.push(cx + (x - cx) * r, y, cz + (z - cz) * r); ru.push(i / n, r);
    }
    for (let k = 0; k < 3; k++) { const a = i * 4 + k, b = ((i + 1) % n) * 4 + k; ri.push(a, b, a + 1, a + 1, b, b + 1); }
  });
  stone.add('travertine', geometry(rp, ri, ru));
  return g;
}
export function createFountainWater(width: number, depth: number, y: number) {
  if (!(width > 0 && depth > 0 && Number.isFinite(width + depth + y))) throw new Error('Invalid basin dimensions');
  const g = new THREE.PlaneGeometry(width, depth, 8, 8).rotateX(-Math.PI / 2).translate(0, y, 0);
  const p = g.getAttribute('position'), d = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) d[i] = Math.min(0.45, Math.max(0.025, Math.min(width / 2 - Math.abs(p.getX(i)), depth / 2 - Math.abs(p.getZ(i)))));
  g.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));
  return new THREE.Mesh(g, createWaterMaterial({ kind: 'basin' }));
}
/** XY sheet, top at local origin, bottom at -height; UV.y=0 is its foamy base. */
export function createWaterSheet(width: number, height: number) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height))) throw new Error('Invalid sheet dimensions');
  const g = new THREE.PlaneGeometry(width, height, 8, 4).translate(0, -height / 2, 0);
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(0.2), 1));
  return new THREE.Mesh(g, createWaterMaterial({ kind: 'sheet' }));
}
export function createSteam(points: readonly THREE.Vector3[], count: number) {
  if (!Number.isInteger(count) || count < 0 || (count > 0 && !points.length)) throw new Error('Invalid steam count/points');
  const uSteam = { value: 0.35 };
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: waterUniforms.uTime, uSteam },
    vertexShader: `uniform float uTime; attribute float aPhase; varying vec2 vUv; varying float vLife;
void main(){ vUv=uv; float phase=aPhase;
vLife=fract(uTime*0.065+phase); vec3 center=instanceMatrix[3].xyz;
center.y+=vLife*5.0; center.x+=sin(vLife*3.14+phase*6.28)*0.5;
vec4 viewCenter=modelViewMatrix*vec4(center,1.0);
viewCenter.xy+=position.xy*(0.8+vLife*2.0);
gl_Position=projectionMatrix*viewCenter; }`,
    fragmentShader: `uniform float uSteam; varying vec2 vUv; varying float vLife;
void main(){ float soft=1.0-smoothstep(0.12,0.5,length(vUv-0.5));
float alpha=soft*sin(vLife*3.14159)*0.17*clamp(uSteam,0.0,1.0);
gl_FragColor=vec4(vec3(0.94,0.98,1.0),alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, count), m = new THREE.Matrix4();
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = points[i % points.length], a = i * 2.39996;
    m.makeTranslation(p.x + Math.sin(a) * 2, p.y + 0.15, p.z + Math.cos(a) * 2);
    phases[i] = (i * 0.618034) % 1; mesh.setMatrixAt(i, m);
  }
  mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  mesh.instanceMatrix.needsUpdate = true;
  // Shader movement is outside the static instance bounds.
  mesh.frustumCulled = false; mesh.name = 'Thermal steam';
  return { mesh, uSteam };
}
export function buildWater(t: Terrain): { group: THREE.Group; volumes: WaterVolume[] } {
  const group = new THREE.Group(); group.name = 'Hierapolis water';
  const stone = new Building('Water masonry'), volumes: WaterVolume[] = [], terraces: THREE.BufferGeometry[] = [], sheets: THREE.BufferGeometry[] = [];
  const [px, pz] = t.toLocal(37.92615, 29.12558), sy = t.heightAt(px, pz) + 0.15;
  const pool: WaterVolume = { id: 'antique-pool', kind: 'pool', polygon: polygon(px, pz, 15, 11, 0.8), surfaceY: sy, floorY: sy - 1.9 };
  volumes.push(pool); group.add(new THREE.Mesh(basin(pool, px, pz, 1.9, stone), createWaterMaterial({ kind: 'pool', fizz: true })));
  stone.box('marble', 27, 0.45, 2.2, px, sy + 0.025, pz - 11.8);
  for (let i = 0; i < 9; i++) {
    const g = column(4.5, 0.28);
    if (i < 3) stone.add('marble', g, { x: px - 10 + i * 9, y: sy + 0.25, z: pz - 11.8 });
    else {
      const x = px - 9 + (i - 3) * 3.1, z = pz - 4 + Math.sin(i * 2.4) * 2;
      g.rotateZ(Math.PI / 2).rotateY(i * 2.399);
      stone.add('marble', g, { x, y: floorAt(pool, x, z) + 0.43, z });
    }
  }
  for (let i = 0; i < 8; i++) {
    const x = px - 8 + i * 2, z = pz + 3 + Math.sin(i) * 2, y = floorAt(pool, x, z);
    stone.add('marble', new THREE.CylinderGeometry(0.3, 0.3, 0.55, 12).rotateZ(0.6), { x, y: y + 0.35, z });
    if (i % 2 === 0) stone.box('marble', 0.85, 0.22, 0.85, x + 0.6, y + 0.16, z + 0.5, i);
  }
  const [tx, tz] = t.toLocal(37.9236, 29.1212);
  for (let row = 0; row < 10; row++) for (let col = 0; col < 6; col++) {
    // Long axes follow the north/south contour; descent is WEST (-X).
    const x = tx + 20 - row * 8, z = tz + (col - 2.5) * 18 + (row % 2) * 2;
    const poly = polygon(x, z, 3.6, 8, row * 0.7 + col), depth = 0.2 + ((row * 7 + col * 3) % 11) * 0.05;
    const rimH = poly.map(([a, b]) => t.heightAt(a, b))
    const ground = Math.max(t.heightAt(x, z), ...rimH);
    // the outer wall reaches down to the lowest ground round the rim, so basins never float on the slope
    const skirt = Math.min(...rimH) - 0.3;
    const surfaceY = ground + depth + 0.03;
    const v: WaterVolume = { id: `travertine-${row}-${col}`, kind: 'terrace', polygon: poly, surfaceY, floorY: surfaceY - depth };
    volumes.push(v); terraces.push(basin(v, x, z, depth, stone, skirt));
    if (row > 0 && col % 2 === 0) {
      const upper = volumes[1 + (row - 1) * 6 + col];
      const drop = upper.surfaceY - surfaceY;
      if (drop > 0.15) {
        const sheet = createWaterSheet(1.2, drop);
        sheet.geometry.rotateY(Math.PI / 2).translate(x + 4, upper.surfaceY, z);
        sheets.push(sheet.geometry); sheet.material.dispose();
      }
    }
  }
  group.add(new THREE.Mesh(combine(terraces), createWaterMaterial({ kind: 'terrace' })));
  if (sheets.length) group.add(new THREE.Mesh(combine(sheets), createWaterMaterial({ kind: 'sheet' })));
  const masonry = stone.finish();
  // Clone shared materials: City may patch originals; ownership remains local and disposable.
  masonry.traverse(o => { if (o instanceof THREE.Mesh) { o.material = (o.material as THREE.MeshStandardMaterial).clone(); if (o.name === 'travertine') o.material.color.set('#f7f5ed'); } });
  group.add(masonry);
  const steam = createSteam([new THREE.Vector3(px, sy, pz)], 48); group.add(steam.mesh);
  group.userData.uSteam = steam.uSteam;
  return { group, volumes };
}
