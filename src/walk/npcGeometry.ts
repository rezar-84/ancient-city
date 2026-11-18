import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Era = 'greek' | 'roman' | 'byzantine';
type Point = [number, number, number];
export const ERA_PALETTES: Record<Era, { cloth: string[]; accent: string[]; hair: string[] }> = {
  greek: { cloth: ['#ddd2b8', '#b59766', '#a44936', '#596781'], accent: ['#b88b36', '#79384e', '#665782'], hair: ['#292019', '#59402c', '#8a7153'] },
  roman: { cloth: ['#e3d9c3', '#b7a489', '#994331', '#656d81'], accent: ['#71334e', '#a54132', '#b59a53'], hair: ['#30231b', '#60452f', '#968577'] },
  byzantine: { cloth: ['#bdb093', '#785b43', '#555e79', '#945044'], accent: ['#b69850', '#683950', '#9f653b'], hair: ['#302721', '#66503b', '#9c9080'] },
};
export const SKIN_TONES: string[] = ['#e0b893', '#cca07a', '#b98860', '#a57551', '#8f6044', '#764e38'];

/** All parts are normalized before merging; ownership of source geometries is consumed. */
class Figure {
  parts: THREE.BufferGeometry[] = [];
  add(source: THREE.BufferGeometry, part = 0, limb = 0, pivot: Point = [0, 0, 0], reach = 1, wheel = 0, shade = 1) {
    const g = source.index ? source.toNonIndexed() : source;
    if (g !== source) source.dispose();
    g.deleteAttribute('uv');
    const p = g.getAttribute('position'), n = p.count;
    const pivots = new Float32Array(n * 3), bend = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pivots.set(pivot, i * 3);
      bend[i] = limb ? Math.min(1, Math.abs(p.getY(i) - pivot[1]) / reach) : 0;
    }
    const colors = new Float32Array(n * 3).fill(shade);
    if (part === 4 || part === 5) {
      const rgb = part === 4 ? [0.025, 0.018, 0.012] : [0.8, 0.76, 0.66];
      for (let i = 0; i < n; i++) colors.set(rgb, i * 3);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // rig data packed into one vec4 (part, limb, bend, wheel) to stay under the 16 vertex-attribute
    // limit of integrated GPUs once instancing (4 slots) and the per-instance attributes are added
    const rigData = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) rigData.set([part, limb, bend[i], wheel], i * 4)
    g.setAttribute('aRig', new THREE.Float32BufferAttribute(rigData, 4));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(pivots, 3));
    this.parts.push(g);
  }
  box(size: Point, center: Point, part = 0, limb = 0, pivot: Point = [0, 0, 0], reach = 1, shade = 1) {
    this.add(new THREE.BoxGeometry(...size).translate(...center), part, limb, pivot, reach, 0, shade);
  }
  finish() {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach(g => g.dispose());
    if (!merged) throw new Error('NPC geometry merge failed');
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    // Conservative static bounds include raised arms and gait swings for frustum culling.
    if (merged.boundingSphere) merged.boundingSphere.radius += 0.8;
    return merged;
  }
}

/** Stable legacy values: walk=0 (also rests at speed zero), talk=1, pray=2. */
export const POSE = { walk: 0, talk: 1, pray: 2, run: 3, idle: 4, wave: 5, sit: 6, carry: 7, swim: 8, tread: 9, drink: 10 } as const;
export const HAIR = { short: 0, curly: 1, bun: 2, veiled: 3, bald: 4 } as const;
export type PersonLOD = 'near' | 'far';

/** 1.70 m / 7.5 heads, soles at zero, facing +Z. aRig.w selects hair shells. */
export function createPersonGeometry(variant: Era, lod: PersonLOD = 'near'): THREE.BufferGeometry {
  const f = new Figure(), near = lod === 'near', n = near ? 10 : 5;
  const head: Point = [0, 1.44, 0];
  const oval = (size: Point, at: Point, part: number, limb = 0, pivot: Point = [0, 0, 0], tag = 0) =>
    f.add(new THREE.SphereGeometry(1, near ? 8 : 4, near ? 5 : 2).scale(...size).translate(...at), part, limb, pivot, 1, tag);
  for (const side of [-1, 1]) {
    const x = side * 0.10, leg = side > 0 ? 1 : 2, arm = side > 0 ? 3 : 4;
    const hip: Point = [x, 0.86, 0], shoulder: Point = [side * 0.215, 1.39, 0];
    f.add(new THREE.CylinderGeometry(0.073, 0.047, 0.76, near ? 7 : 4, 2).translate(x, 0.46, 0), 1, leg, hip);
    f.box([0.115, 0.045, 0.235], [x, 0.0225, 0.055], 3, leg, hip, 1, 0.42);
    if (near) f.box([0.119, 0.025, 0.045], [x, 0.065, 0.08], 3, leg, hip);
    // Era-differentiated sleeves: sleeveless pinned Greek chiton, short-sleeved Roman tunica, long-sleeved Byzantine dalmatica
    const upperSleevePart = variant === 'greek' ? 1 : 0;
    const lowerSleevePart = variant === 'byzantine' ? 0 : 1;
    const lowerR0 = variant === 'byzantine' ? 0.055 : 0.049;
    const lowerR1 = variant === 'byzantine' ? 0.040 : 0.032;
    f.add(new THREE.CylinderGeometry(0.071, 0.052, 0.26, near ? 7 : 4).translate(side * 0.235, 1.26, 0), upperSleevePart, arm, shoulder);
    f.add(new THREE.CylinderGeometry(lowerR0, lowerR1, 0.27, near ? 7 : 4).translate(side * 0.245, 0.995, 0.015), lowerSleevePart, arm, shoulder);
    if (near && variant === 'byzantine') {
      f.add(new THREE.CylinderGeometry(0.043, 0.042, 0.032, 6, 1, true).translate(side * 0.245, 0.875, 0.018), 3, arm, shoulder);
    }
    if (near && variant === 'greek') {
      f.box([0.036, 0.022, 0.05], [side * 0.175, 1.385, 0], 3);
    }
    oval([0.038, 0.065, 0.029], [side * 0.245, 0.825, 0.02], 1, arm, shoulder);
  }
  // Era-differentiated garment silhouette: snug contoured waist, kolpos blousing above belt, and rear seat ease below belt.
  const bottom = variant === 'greek' ? 0.50 : variant === 'roman' ? 0.36 : 0.14;
  const kolposGain = variant === 'greek' ? 0.095 : variant === 'roman' ? 0.055 : 0.025;
  const foldFreq = variant === 'greek' ? 12 : variant === 'roman' ? 10 : 8;
  const garment = new THREE.CylinderGeometry(0.20, 0.285, 1.39 - bottom, n * 2, near ? 5 : 2, true);
  const gp = garment.getAttribute('position');
  for (let i = 0; i < gp.count; i++) {
    const rawX = gp.getX(i), rawZ = gp.getZ(i);
    const y = gp.getY(i) + (1.39 + bottom) / 2, angle = Math.atan2(rawZ, rawX);
    const waist = 1 - 0.26 * Math.exp(-(((y - 0.94) / 0.15) ** 2)) + kolposGain * Math.exp(-(((y - 1.01) / 0.055) ** 2));
    const below = THREE.MathUtils.clamp((0.94 - y) / Math.max(0.1, 0.94 - bottom), 0, 1);
    const fold = 1 + (near ? 0.068 : 0.036) * (0.4 + 0.6 * below) * Math.cos(angle * foldFreq + y * 0.7);
    const rearSeat = rawZ < 0 ? -0.028 * Math.sin(Math.min(1, below * 1.45) * Math.PI * 0.85) * (-rawZ / Math.max(0.05, Math.hypot(rawX, rawZ))) : 0;
    gp.setXYZ(i, rawX * waist * fold, y, rawZ * waist * fold * 0.66 + rearSeat);
  }
  garment.computeVertexNormals(); f.add(garment);
  // Waist belt / cord cinch + era-specific woven hem border (Greek meander / Byzantine tapestry band) or Roman clavi
  const beltH = variant === 'roman' ? 0.028 : 0.038;
  f.add(new THREE.CylinderGeometry(0.188, 0.188, beltH, n, 1, true).scale(1, 1, 0.70).translate(0, 0.94, -0.004), 3);
  if (near && variant !== 'roman') {
    f.add(new THREE.CylinderGeometry(0.284, 0.288, 0.042, n, 1, true).scale(1, 1, 0.68).translate(0, bottom + 0.024, -0.012), 3);
  }
  if (near && (variant === 'roman' || variant === 'byzantine')) {
    for (const s of [-1, 1]) {
      f.box([0.024, 0.42, 0.265], [s * 0.088, 1.16, -0.004], 3);
    }
  }
  // Diagonal mantle folds: Greek himation / Roman pallium / long Byzantine mantle.
  if (near) {
    const drape = new THREE.CylinderGeometry(0.221, 0.25, variant === 'byzantine' ? 0.88 : variant === 'greek' ? 0.66 : 0.58, 12, 3, true, 0.15, Math.PI * 1.5);
    const dp = drape.getAttribute('position');
    for (let i = 0; i < dp.count; i++) dp.setY(i, dp.getY(i) + 0.15 * Math.sin(Math.atan2(dp.getZ(i), dp.getX(i))));
    drape.scale(1, 1, 0.76).translate(0, 1.08, -0.012); drape.computeVertexNormals(); f.add(drape, 3);
  }
  f.add(new THREE.CylinderGeometry(0.049, 0.057, 0.10, near ? 8 : 4).translate(0, 1.435, 0), 1, 5, head);
  const face = new THREE.SphereGeometry(1, near ? 12 : 6, near ? 8 : 3);
  const fp = face.getAttribute('position');
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i), jaw = y < -0.2 ? 0.82 : 1;
    fp.setXYZ(i, fp.getX(i) * 0.09 * jaw, y * 0.113 + 1.577, fp.getZ(i) * 0.09 + 0.012);
  }
  face.computeVertexNormals(); f.add(face, 1, 5, head);
  if (near) {
    oval([0.065, 0.04, 0.066], [0, 1.49, 0.03], 1, 5, head);
    f.add(new THREE.ConeGeometry(0.022, 0.058, 4).rotateX(-0.3).scale(0.65, 1, 1).translate(0, 1.567, 0.102), 1, 5, head);
    for (const side of [-1, 1]) {
      oval([0.016, 0.028, 0.012], [side * 0.091, 1.568, 0.005], 1, 5, head);
      f.box([0.031, 0.008, 0.009], [side * 0.037, 1.602, 0.091], 2, 5, head);
      f.box([0.025, 0.010, 0.007], [side * 0.037, 1.588, 0.095], 5, 5, head);
      f.box([0.009, 0.010, 0.009], [side * 0.037, 1.588, 0.099], 4, 5, head);
    }
    f.box([0.032, 0.005, 0.006], [0, 1.518, 0.094], 1, 5, head, 1, 0.6);
  }
  // Shared cap for short/curly/bun; curl silhouette is displaced in the shader.
  f.add(new THREE.SphereGeometry(1, near ? 12 : 6, near ? 4 : 2, 0, Math.PI * 2, 0, 1.65)
    .scale(0.096, 0.081, 0.097).translate(0, 1.62, 0.006), 2, 5, head, 1, 1);
  oval([0.057, 0.052, 0.055], [0, 1.605, -0.107], 2, 5, head, 2);
  f.add(new THREE.SphereGeometry(1, near ? 10 : 5, near ? 5 : 2, 0, Math.PI * 2, 0, 2.05)
    .scale(0.135, 0.21, 0.13).translate(0, 1.49, -0.035), 0, 5, head, 1, 3);
  oval([0.071, 0.063, 0.042], [0, 1.488, 0.066], 2, 5, head, 4);
  return f.finish();
}

/** Props use the right wrist rig, except the head-supported basket. Share instance data/matrices. */
export function createHeldPropGeometry(kind: 'amphora' | 'basket' | 'staff' | 'scroll'): THREE.BufferGeometry {
  const f = new Figure(), pivot: Point = kind === 'basket' ? [0, 1.44, 0] : [-0.215, 1.39, 0];
  const limb = kind === 'basket' ? 5 : 4;
  const add = (g: THREE.BufferGeometry) => f.add(g, 3, limb, pivot);
  if (kind === 'basket') {
    add(new THREE.CylinderGeometry(0.21, 0.14, 0.24, 12).translate(0, 1.82, 0));
    for (const y of [1.72, 1.78, 1.84, 1.9]) add(new THREE.TorusGeometry(0.16 + (y - 1.72) * 0.25, 0.009, 4, 12).rotateX(Math.PI / 2).translate(0, y, 0));
  } else if (kind === 'amphora') {
    add(new THREE.LatheGeometry([[0, -0.16], [0.055, -0.12], [0.10, 0.02], [0.075, 0.12], [0.035, 0.15], [0.035, 0.23], [0.05, 0.24]].map(([x,y]) => new THREE.Vector2(x,y)), 12).translate(-0.245, 0.72, 0.11));
    for (const x of [-0.32, -0.17]) add(new THREE.TorusGeometry(0.06, 0.012, 4, 8).scale(0.7, 1, 1).translate(x, 0.86, 0.11));
  } else {
    add(new THREE.CylinderGeometry(kind === 'staff' ? 0.018 : 0.045, kind === 'staff' ? 0.022 : 0.045, kind === 'staff' ? 1.55 : 0.26, 8).translate(-0.245, 0.825, 0.055));
  }
  return f.finish();
}

/** Withers at 1.6 m; +Z is forward. FL/FR/BL/BR are limb IDs 1/2/3/4. Includes Roman breast-collar harness & bridle. */
export function createHorseGeometry(): THREE.BufferGeometry {
  const f = new Figure();
  f.add(new THREE.SphereGeometry(1, 12, 8).scale(0.34, 0.37, 0.85).translate(0, 1.25, 0));
  for (const [x, z, limb] of [[0.23, 0.53, 1], [-0.23, 0.53, 2], [0.23, -0.53, 3], [-0.23, -0.53, 4]]) {
    const hip: Point = [x, 1.27, z];
    f.add(new THREE.CylinderGeometry(0.11, 0.075, 0.55, 6).translate(x, 0.99, z), 0, limb, hip, 1.1);
    f.add(new THREE.CylinderGeometry(0.065, 0.055, 0.61, 6).translate(x, 0.41, z + 0.025), 0, limb, hip, 1.1);
    f.box([0.15, 0.12, 0.2], [x, 0.06, z + 0.06], 2, limb, hip, 1.1, 0.35);
  }
  const neck: Point = [0, 1.35, 0.57];
  const arch = new THREE.CylinderGeometry(0.13, 0.26, 0.82, 10, 5);
  const ap = arch.getAttribute('position');
  for (let i = 0; i < ap.count; i++) {
    const t = (ap.getY(i) + 0.41) / 0.82;
    ap.setZ(i, ap.getZ(i) + 0.22 * t + 0.09 * Math.sin(t * Math.PI));
  }
  arch.computeVertexNormals();
  f.add(arch.translate(0, 1.62, 0.65), 0, 5, neck);
  f.add(new THREE.SphereGeometry(1, 10, 6).scale(0.13, 0.17, 0.31).rotateX(0.28).translate(0, 1.96, 1.03), 0, 5, neck);
  f.add(new THREE.SphereGeometry(1, 8, 5).scale(0.105, 0.10, 0.14).translate(0, 1.86, 1.30), 0, 5, neck, 1, 0, 0.65);
  for (const side of [-1, 1]) {
    f.add(new THREE.SphereGeometry(1, 6, 3).scale(0.009, 0.018, 0.018).translate(side*0.126, 2.0, 1.12), 4, 5, neck);
  }
  for (const x of [-0.085, 0.085]) f.add(new THREE.ConeGeometry(0.065, 0.23, 4).translate(x, 2.15, 0.91), 0, 5, neck, 0.5);
  f.add(new THREE.CylinderGeometry(0.035, 0.075, 0.72, 6, 4).scale(1,1,1.6).rotateX(0.28).translate(0,1.69,0.55), 2, 7, neck, 1, 0, 0.3);
  f.add(new THREE.CylinderGeometry(0.08, 0.025, 0.8, 5).rotateX(-0.35).translate(0, 0.99, -0.88), 2, 6, [0, 1.37, -0.72], 1, 0, 0.3);
  // Dorsal saddle pad (dorsuale), belly girth, tug loops at (±0.40, 1.18, 0.20), breast-collar (pectorale) & breeching
  f.box([0.74, 0.08, 0.18], [0, 1.56, 0.20], 3);
  f.box([0.66, 0.045, 0.09], [0, 0.90, 0.20], 3, 0, [0, 0, 0], 1, 0.65);
  f.box([0.72, 0.095, 0.08], [0, 1.18, 0.84], 3);
  f.box([0.68, 0.075, 0.07], [0, 1.18, -0.82], 3);
  for (const s of [-1, 1]) {
    f.box([0.055, 0.66, 0.11], [s * 0.36, 1.23, 0.20], 3);
    f.add(new THREE.BoxGeometry(0.045, 0.09, 0.68).rotateY(s * 0.08).translate(s * 0.37, 1.18, 0.52), 3);
    f.add(new THREE.BoxGeometry(0.04, 0.075, 1.02).translate(s * 0.36, 1.18, -0.31), 3);
    // Shaft tug loop & bronze terret ring
    f.add(new THREE.TorusGeometry(0.055, 0.016, 4, 8).rotateY(Math.PI / 2).translate(s * 0.40, 1.18, 0.20), 3, 0, [0, 0, 0], 1, 0, 1.25);
    f.add(new THREE.TorusGeometry(0.036, 0.01, 4, 8).translate(s * 0.16, 1.63, 0.20), 3, 0, [0, 0, 0], 1, 0, 1.35);
    // Reins from bit to terret ring
    f.add(new THREE.BoxGeometry(0.018, 0.022, 0.96).rotateX(-0.24).translate(s * 0.145, 1.74, 0.68), 3, 5, neck, 0.35, 0, 0.7);
  }
  // Bridle: noseband, browband, cheek straps and bronze bit rings
  f.box([0.24, 0.045, 0.055], [0, 1.91, 1.27], 3, 5, neck, 0.5);
  f.box([0.27, 0.04, 0.045], [0, 2.04, 1.03], 3, 5, neck, 0.5);
  for (const x of [-0.135, 0.135]) {
    f.box([0.025, 0.27, 0.045], [x, 1.95, 1.12], 3, 5, neck, 0.5);
    f.add(new THREE.TorusGeometry(0.032, 0.009, 4, 8).rotateY(Math.PI / 2).translate(x, 1.87, 1.27), 3, 5, neck, 0.5, 0, 1.35);
  }
  return f.finish();
}

/** Standalone harness & bridle meshes for the close-up rigged GLB draught horse (metre coordinates). */
export function createDetailedHorseHarness(): { body: THREE.Group; head: THREE.Group; dispose: () => void } {
  const leather = new THREE.MeshStandardMaterial({ color: '#5c3322', roughness: 0.78 });
  const padMat = new THREE.MeshStandardMaterial({ color: '#7a2f2a', roughness: 0.88 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#b58d47', metalness: 0.62, roughness: 0.38 });
  const geometries: THREE.BufferGeometry[] = [];
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  const body = new THREE.Group();
  // Padded dorsal saddle-band (dorsuale), side straps & belly girth around the GLB barrel
  body.add(mk(new THREE.BoxGeometry(0.76, 0.075, 0.22).translate(0.03, 1.41, 0.20), padMat));
  body.add(mk(new THREE.BoxGeometry(0.78, 0.045, 0.12).translate(0.03, 1.44, 0.20), leather));
  body.add(mk(new THREE.BoxGeometry(0.66, 0.04, 0.09).translate(0.03, 0.82, 0.20), leather));
  // Wide breast-collar (pectorale) & breeching strap (postilena)
  body.add(mk(new THREE.BoxGeometry(0.74, 0.10, 0.08).translate(0.03, 1.18, 0.80), leather));
  body.add(mk(new THREE.BoxGeometry(0.70, 0.085, 0.07).translate(0.03, 1.16, -0.84), leather));
  for (const pz of [-0.22, 0, 0.22]) {
    body.add(mk(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 10).rotateX(Math.PI / 2).translate(0.03 + pz, 1.18, 0.845), bronze));
  }
  for (const s of [-1, 1]) {
    const sx = 0.03 + s * 0.38;
    body.add(mk(new THREE.BoxGeometry(0.05, 0.60, 0.11).translate(sx, 1.12, 0.20), leather));
    body.add(mk(new THREE.BoxGeometry(0.045, 0.095, 0.62).rotateY(s * 0.07).translate(sx, 1.18, 0.50), leather));
    body.add(mk(new THREE.BoxGeometry(0.04, 0.08, 1.04).translate(sx - s * 0.01, 1.17, -0.32), leather));
    // Shaft tug loop at (±0.40, 1.18, 0.20) + bronze buckle & dorsal terret ring
    body.add(mk(new THREE.TorusGeometry(0.058, 0.017, 6, 12).rotateY(Math.PI / 2).translate(0.03 + s * 0.40, 1.18, 0.20), leather));
    body.add(mk(new THREE.TorusGeometry(0.038, 0.01, 6, 12).translate(0.03 + s * 0.16, 1.49, 0.20), bronze));
    // Reins draped from terret back toward the cart front bolster
    body.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 1.95, 5).rotateX(Math.PI / 2 + 0.19).translate(0.03 + s * 0.18, 1.31, -0.74), leather));
  }
  const head = new THREE.Group();
  // Headstall relative to Head world reference (0.02, 1.78, 0.98)
  head.add(mk(new THREE.BoxGeometry(0.24, 0.038, 0.048).translate(0, -0.06, 0.34), leather));
  head.add(mk(new THREE.BoxGeometry(0.27, 0.035, 0.042).translate(0, 0.08, 0.10), leather));
  for (const s of [-1, 1]) {
    head.add(mk(new THREE.BoxGeometry(0.024, 0.25, 0.04).rotateX(0.32).translate(s * 0.13, 0.01, 0.21), leather));
    head.add(mk(new THREE.TorusGeometry(0.032, 0.009, 5, 10).rotateY(Math.PI / 2).translate(s * 0.132, -0.09, 0.35), bronze));
    head.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.84, 5).rotateX(Math.PI / 2 - 0.24).translate(s * 0.14, -0.19, -0.04), leather));
  }
  return {
    body,
    head,
    dispose() {
      geometries.forEach(g => g.dispose());
      leather.dispose(); padMat.dispose(); bronze.dispose();
    },
  };
}

/** Axle lies on X (1.42 m Roman track gauge); origin is ground level directly below its centre.
 * Angled shafts rise from y=0.66 at the front bolster to (x=±0.40, y=1.18, z=+2.80), matching the horse's tug loops 2.6 m ahead. */
export function createCartGeometry(): THREE.BufferGeometry {
  const f = new Figure();
  // Planked timber bed, heavy axle tree, bolsters & crossbars
  f.box([1.22, 0.11, 1.70], [0, 0.67, 0], 0);
  f.box([1.64, 0.095, 0.095], [0, 0.55, 0], 3);
  f.box([1.26, 0.08, 0.12], [0, 0.61, 0.76], 0, 0, [0, 0, 0], 1, 0.82);
  f.box([1.26, 0.08, 0.12], [0, 0.61, -0.76], 0, 0, [0, 0, 0], 1, 0.82);
  for (const x of [-0.58, 0.58]) {
    f.box([0.07, 0.42, 1.70], [x, 0.92, 0], 0);
    for (const stakeZ of [-0.72, -0.24, 0.24, 0.72]) f.box([0.085, 0.48, 0.065], [x, 0.94, stakeZ], 0, 0, [0, 0, 0], 1, 0.78);
  }
  // Angled ash-wood draught shafts converging from (±0.52, 0.66, 0.76) up to horse tug loops (±0.40, 1.18, 2.80)
  for (const s of [-1, 1]) {
    const shaft = new THREE.BoxGeometry(0.072, 0.082, 2.14)
      .rotateX(-0.249)
      .rotateY(-s * 0.058)
      .translate(s * 0.46, 0.92, 1.78);
    f.add(shaft, 0);
    // Iron shaft band & trace hook at the tug loop attachment point
    f.box([0.088, 0.096, 0.12], [s * 0.40, 1.18, 2.80], 3, 0, [0, 0, 0], 1, 1.2);
  }
  // Front & rear planked gates
  f.box([1.22, 0.40, 0.07], [0, 0.92, -0.81], 0);
  f.box([1.22, 0.26, 0.06], [0, 0.85, 0.82], 0);
  // 1.10 m diameter wheels (r=0.55) at 1.42 m track gauge (x = ±0.71) with iron tires, 8 spokes, nave hubs & linchpins
  for (const s of [-1, 1]) {
    const x = s * 0.71;
    const hub: Point = [x, 0.55, 0];
    // Shrunk-on iron tire rim + wooden felloe band (kept >= y=0)
    f.add(new THREE.TorusGeometry(0.515, 0.034, 6, 14).rotateY(Math.PI / 2).translate(...hub), 3, 0, hub, 1, 1, 0.55);
    f.add(new THREE.TorusGeometry(0.475, 0.042, 5, 14).rotateY(Math.PI / 2).translate(...hub), 0, 0, hub, 1, 1, 0.88);
    // Nave hub + bronze linchpin cap
    f.add(new THREE.CylinderGeometry(0.095, 0.095, 0.18, 8).rotateZ(Math.PI / 2).translate(...hub), 0, 0, hub, 1, 1, 0.72);
    f.box([0.03, 0.14, 0.03], [x + s * 0.105, 0.55, 0], 3);
    for (const angle of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      f.add(new THREE.BoxGeometry(0.055, 0.92, 0.042).rotateX(angle).translate(...hub), 0, 0, hub, 1, 1);
    }
  }
  // Lashed wool bales & stone block cargo
  for (const x of [-0.27, 0.27]) {
    f.box([0.48, 0.42, 1.12], [x, 0.94, -0.06], 1);
    f.box([0.50, 0.44, 0.035], [x, 0.94, -0.28], 3);
    f.box([0.50, 0.44, 0.035], [x, 0.94, 0.18], 3);
  }
  return f.finish();
}

/** Optional additions: iStyle=hair RGB, style+5*beard; iPose=previous pose, blend.
 * Unattached attributes have material defaults, keeping existing Crowd callers valid. */
export function createCrowdAttributes(count: number) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Crowd count must be a nonnegative integer');
  const attribute = (size: number, fill: number) => new THREE.InstancedBufferAttribute(new Float32Array(count * size).fill(fill), size).setUsage(THREE.DynamicDrawUsage);
  const style = attribute(4, 0), pose = attribute(2, 0);
  for (let i = 0; i < count; i++) { style.setXYZW(i, 0.08, 0.045, 0.025, 0); pose.setXY(i, 0, 1); }
  return { anim: attribute(4, 0), tint0: attribute(3, 1), tint1: attribute(3, 1), tint2: attribute(3, 1), style, pose };
}

/** Same shader deformation for visible and depth passes. Advance both uTime uniforms. */
export function patchCrowdMaterial(mat: THREE.MeshStandardMaterial | THREE.MeshDepthMaterial, kind: 'person' | 'horse' | 'cart'): void {
  const time = { value: 0 };
  mat.userData.uTime = time;
  // WebGLBindingStates reads these for missing optional geometry attributes.
  (mat as typeof mat & { defaultAttributeValues: Record<string, number[]> }).defaultAttributeValues = {
    iStyle: [0.08, 0.045, 0.025, 0], iPose: [0, 1],
  };
  mat.vertexColors = true;
  mat.customProgramCacheKey = () => `npc-v4-${kind}`;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    if (mat instanceof THREE.MeshDepthMaterial) {
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '')
        .replace('#include <begin_vertex>', '#include <beginnormal_vertex>\n#include <begin_vertex>');
    }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 iAnim, iStyle;
attribute vec2 iPose;
attribute vec3 iTint0, iTint1, iTint2;
attribute vec4 aRig;
attribute vec3 aPivot;
#define aPart aRig.x
#define aLimb aRig.y
#define aBend aRig.z
#define aWheel aRig.w
uniform float uTime;
varying vec3 vNpcTint;
${Object.entries(POSE).map(([name, value]) => `#define POSE_${name} ${value.toFixed(1)}`).join('\n')}
mat3 npcX(float a) { float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 npcY(float a) { float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 npcZ(float a) { float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
// Parameter interpolation preserves rigid limb lengths across pose transitions.
void npcPose(float pose, out vec3 angles, out float joint, out vec3 root, out float lean) {
  float speed = clamp(iAnim.y, 0., 1.);
  if (pose == POSE_run) speed = max(speed, 0.8);
  if (pose == POSE_idle || pose == POSE_sit || pose == POSE_drink) speed = 0.;
  float phase = iAnim.x + uTime * mix(2., 10., speed);
  float beat = sin(phase), side = aLimb == 1. || aLimb == 3. ? 1. : -1.;
  bool leg = aLimb > 0.5 && aLimb < 2.5;
  bool arm = aLimb > 2.5 && aLimb < 4.5;
  angles = vec3(0.); joint = 0.; lean = 0.;
  root = vec3((1.-speed)*sin(uTime*1.2+iAnim.x)*0.008, (1.-speed)*sin(uTime*1.8+iAnim.x)*0.004 + speed*(1.-cos(phase*2.))*0.015, 0.);
  if (leg) { angles.x = beat * side * speed * 0.65; joint = -max(0., beat*side)*speed*0.9; }
  if (arm) { angles.x = -beat * side * speed * 0.45; joint = 0.12 + speed*0.3; }
  if (pose == POSE_walk) lean = speed*0.035;
  if (pose == POSE_run) { lean = 0.14; if (arm) joint = 1.0; }
  if (pose == POSE_talk && arm) { angles.x = -0.35 + sin(uTime*3.+side)*0.18; joint = 0.9 + sin(uTime*2.+side)*0.2; }
  if (pose == POSE_wave && aLimb == 4.) { angles.x = -2.5; angles.z = sin(uTime*5.+iAnim.x)*0.28; joint = 0.35; }
  if (pose == POSE_pray && arm) { angles.x = -2.; angles.z = side*0.40; joint = 0.35; }
  if (pose == POSE_carry && arm) { angles.x = -2.65; angles.z = side*0.12; joint = 0.55; }
  if (pose == POSE_sit) {
    root = vec3(0., -0.40, 0.);
    if (leg) { angles.x = -1.5707963; joint = 1.5707963; }
    if (arm) { angles.x = -0.35; joint = 0.7; }
  }
  if (pose == POSE_swim) {
    lean = 1.5707963; root = vec3(0., -1.20, 0.);
    if (arm) { angles.x = -2.8 + 0.5*sin(phase); angles.z = side*(0.6+0.6*cos(phase)); joint = 0.5+0.4*sin(phase); }
    if (leg) { angles.z = side*(0.15+0.15*cos(phase)); angles.x = 0.1; joint = -0.5*(1.+sin(phase)); }
  }
  if (pose == POSE_tread) {
    root.y = -1.20 + sin(phase)*0.025;
    if (arm) { angles.x = -1.2; angles.z = side*(0.5+0.3*sin(phase)); joint = 0.4; }
    if (leg) { angles.x = side*sin(phase)*0.25; joint = -0.35; }
  }
  if (pose == POSE_drink) { lean = 0.75; if (arm) { angles.x = -0.9; joint = 0.9; } }
  if (aLimb == 5.) angles.y = clamp(iAnim.w, -1.2, 1.2);
}
`).replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
vec3 npcAngles = vec3(0.), npcRoot = vec3(0.);
float npcFlex = 0., npcLean = 0.;
float npcSpeed = clamp(iAnim.y, 0., 1.);
float npcPhase = iAnim.x + uTime * mix(2., 10., npcSpeed);
${kind === 'person' ? `
vec3 prevAngles, prevRoot; float prevFlex, prevLean;
npcPose(iAnim.z, npcAngles, npcFlex, npcRoot, npcLean);
npcPose(iPose.x, prevAngles, prevFlex, prevRoot, prevLean);
float blend = smoothstep(0., 1., clamp(iPose.y, 0., 1.));
npcAngles = mix(prevAngles, npcAngles, blend); npcFlex = mix(prevFlex, npcFlex, blend);
npcRoot = mix(prevRoot, npcRoot, blend); npcLean = mix(prevLean, npcLean, blend);
` : kind === 'horse' ? `
if (aLimb > 0.5 && aLimb < 4.5) {
  float walkOffset = (aLimb-1.)*1.5707963;
  float trotOffset = (aLimb == 1. || aLimb == 4.) ? 0. : 3.1415926;
  npcAngles.x = sin(npcPhase + mix(walkOffset,trotOffset,smoothstep(0.55,0.85,npcSpeed)))*npcSpeed*0.65;
}
if (aLimb == 5.) npcAngles.y = iAnim.w*0.4;
if (aLimb == 6.) npcAngles.z = sin(npcPhase*0.7)*0.22;
if (aLimb == 7.) npcAngles.z = sin(npcPhase+position.y*5.)*npcSpeed*0.08;
npcRoot.y = npcSpeed*(1.-cos(npcPhase*2.))*0.025;
` : 'npcAngles.x = aWheel * (iAnim.x + uTime * npcSpeed * 6.);'}
mat3 npcJoint = mat3(1.);
vec3 npcJointPivot = aPivot;
${kind === 'person' ? `
if (aLimb > 0.5 && aLimb < 2.5 && position.y < 0.48) {
  npcJoint = npcX(npcFlex); npcJointPivot = vec3(aPivot.x,0.46,0.);
}
if (aLimb > 2.5 && aLimb < 4.5 && position.y < 1.14) {
  npcJoint = npcX(-npcFlex); npcJointPivot = vec3(aPivot.x,1.13,0.015);
}
` : ''}
mat3 npcRotation = npcY(npcAngles.y) * npcZ(npcAngles.z) * npcX(npcAngles.x);
mat3 npcBody = npcX(npcLean);
objectNormal = npcBody * npcRotation * npcJoint * objectNormal;
#ifdef USE_TANGENT
objectTangent = npcBody * npcRotation * npcJoint * objectTangent;
#endif
`).replace('#include <begin_vertex>', `#include <begin_vertex>
${kind === 'person' ? `
float hairStyle = mod(floor(iStyle.w+0.01),5.);
bool hideHair = (aWheel == 1. && hairStyle > 2.) || (aWheel == 2. && hairStyle != 2.) || (aWheel == 3. && hairStyle != 3.) || (aWheel == 4. && iStyle.w < 5.);
if (hideHair) transformed = aPivot;
if (aWheel == 1. && hairStyle == 1.) transformed += normal * (0.006 + 0.004*sin(position.x*240.)*sin(position.z*240.));
// Smooth side & rear hem displacement following stride phase; torso stays anchored at the belt.
if (aLimb == 0. && aPart < 0.5) {
  float hem = clamp((0.94-position.y)/0.7,0.,1.);
  transformed.x += sin(npcPhase+position.z*12.)*npcSpeed*0.025*hem*hem;
  transformed.z += sin(npcPhase)*clamp(position.x*6.,-1.,1.)*npcSpeed*0.075*hem - npcSpeed*0.032*hem*hem;
  // Fold the front garment over seated thighs instead of leaving it through the seat.
  float sitting = mix(iPose.x == POSE_sit ? 1. : 0., iAnim.z == POSE_sit ? 1. : 0., blend);
  transformed = mix(transformed, npcX(-1.5707963)*(transformed-vec3(0.,0.86,0.))+vec3(0.,0.86,0.), sitting*clamp((0.94-position.y)/0.12,0.,1.));
}
` : ''}
transformed = npcJoint * (transformed - npcJointPivot) + npcJointPivot;
transformed = npcRotation * (transformed - aPivot) + aPivot;
transformed = npcBody * (transformed - vec3(0.,1.20,0.)) + vec3(0.,1.20,0.) + npcRoot;
vNpcTint = aPart < 0.5 ? iTint0 : (aPart < 2.5 ? iTint1 : iTint2);
${kind === 'person' ? `
if (aPart == 2.) vNpcTint = iStyle.rgb;
if (aPart == 4. || aPart == 5.) vNpcTint = vec3(1.);
` : ''}
`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNpcTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vNpcTint;');
  };
  mat.needsUpdate = true;
}
