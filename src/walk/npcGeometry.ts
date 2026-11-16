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
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
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

/** 1.68 m, feet at Y=0, face toward +Z. Limb labels use the figure's own left. */
export function createPersonGeometry(variant: Era): THREE.BufferGeometry {
  const f = new Figure();
  for (const side of [-1, 1]) {
    const x = side * 0.105, leg = side === 1 ? 1 : 2, arm = side === 1 ? 3 : 4;
    const hip: Point = [x, 0.85, 0], shoulder: Point = [side * 0.225, 1.35, 0];
    f.box([0.13, 0.37, 0.15], [x, 0.66, 0], 1, leg, hip, 0.7);
    f.box([0.105, 0.36, 0.12], [x, 0.285, 0], 1, leg, hip, 0.7);
    f.box([0.13, 0.1, 0.24], [x, 0.05, 0.055], 2, leg, hip, 0.7, 0.45);
    f.box([0.115, 0.27, 0.14], [side * 0.26, 1.22, 0], 0, arm, shoulder, 0.5);
    f.box([0.09, 0.25, 0.105], [side * 0.28, 0.97, 0.025], 1, arm, shoulder, 0.5);
    f.box([0.095, 0.12, 0.09], [side * 0.28, 0.795, 0.04], 1, arm, shoulder, 0.5);
    const bottom = variant === 'greek' ? 0.54 : 0.13;
    // Separate overlapping skirt panels carry opposite hip weights, with gentle hem sway.
    f.add(new THREE.CylinderGeometry(0.12, 0.175, 0.88 - bottom, 6).translate(x, (0.88 + bottom) / 2, 0), 0, leg, hip, 2.5);
  }
  f.add(new THREE.CylinderGeometry(0.23, 0.19, 0.49, 6).translate(0, 1.105, 0));
  f.box([0.4, 0.055, 0.32], [0, 0.91, 0], 3);
  f.box([0.085, 0.66, 0.035], [-0.12, 1.03, 0.174], 3);
  const drape = new THREE.BoxGeometry(variant === 'greek' ? 0.18 : 0.26, 0.65, 0.055)
    .rotateZ(-0.22).translate(0.08, 1.12, -0.15);
  f.add(drape);
  const neck: Point = [0, 1.4, 0];
  f.box([0.095, 0.09, 0.1], [0, 1.405, 0], 1, 5, neck, 0.08);
  f.add(new THREE.IcosahedronGeometry(1, 0).scale(0.115, 0.135, 0.115).translate(0, 1.535, 0.015), 1, 5, neck, 0.08);
  f.add(new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2)
    .scale(0.125, 0.11, 0.125).translate(0, 1.57, 0), 2, 5, neck, 0.08, 0, 0.38);
  if (variant === 'byzantine') f.box([0.27, 0.32, 0.065], [0, 1.47, -0.12], 2, 5, neck, 0.08, 0.7);
  return f.finish();
}

/** Withers at 1.6 m; +Z is forward. FL/FR/BL/BR are limb IDs 1/2/3/4. */
export function createHorseGeometry(): THREE.BufferGeometry {
  const f = new Figure();
  f.add(new THREE.CylinderGeometry(0.34, 0.32, 1.4, 8).rotateX(Math.PI / 2).scale(1, 1.1, 1).translate(0, 1.24, 0));
  for (const [x, z, limb] of [[0.23, 0.53, 1], [-0.23, 0.53, 2], [0.23, -0.53, 3], [-0.23, -0.53, 4]]) {
    const hip: Point = [x, 1.27, z];
    f.add(new THREE.CylinderGeometry(0.11, 0.075, 0.55, 6).translate(x, 0.99, z), 0, limb, hip, 1.1);
    f.add(new THREE.CylinderGeometry(0.065, 0.055, 0.61, 6).translate(x, 0.41, z + 0.025), 0, limb, hip, 1.1);
    f.box([0.15, 0.12, 0.2], [x, 0.06, z + 0.06], 2, limb, hip, 1.1, 0.35);
  }
  const neck: Point = [0, 1.35, 0.57];
  f.add(new THREE.CylinderGeometry(0.15, 0.25, 0.77, 6).rotateX(0.48).translate(0, 1.62, 0.76), 0, 5, neck, 0.5);
  f.box([0.25, 0.28, 0.53], [0, 1.93, 1.04], 0, 5, neck, 0.5);
  f.box([0.22, 0.19, 0.21], [0, 1.83, 1.33], 0, 5, neck, 0.5, 0.7);
  for (const x of [-0.085, 0.085]) f.add(new THREE.ConeGeometry(0.065, 0.23, 4).translate(x, 2.15, 0.91), 0, 5, neck, 0.5);
  f.box([0.08, 0.71, 0.16], [0, 1.66, 0.58], 2, 5, neck, 0.5, 0.3);
  f.add(new THREE.CylinderGeometry(0.08, 0.025, 0.8, 5).rotateX(-0.35).translate(0, 0.99, -0.88), 2, 0, [0, 0, 0], 1, 0, 0.3);
  f.box([0.7, 0.075, 0.13], [0, 1.47, 0.26], 3);
  f.box([0.27, 0.06, 0.055], [0, 1.92, 1.29], 3, 5, neck, 0.5);
  for (const x of [-0.137, 0.137]) f.box([0.025, 0.27, 0.055], [x, 1.94, 1.06], 3, 5, neck, 0.5);
  return f.finish();
}

/** Axle lies on X; origin is ground level directly below its centre. */
export function createCartGeometry(): THREE.BufferGeometry {
  const f = new Figure();
  f.box([1.22, 0.12, 1.65], [0, 0.68, 0], 0);
  f.box([1.6, 0.09, 0.09], [0, 0.55, 0], 3);
  for (const x of [-0.61, 0.61]) {
    f.box([0.075, 0.4, 1.65], [x, 0.92, 0], 0);
    f.box([0.075, 0.085, 2.3], [x, 0.68, 1.8], 0);
  }
  f.box([1.22, 0.4, 0.075], [0, 0.92, -0.79], 0);
  for (const x of [-0.75, 0.75]) {
    const hub: Point = [x, 0.55, 0];
    f.add(new THREE.CylinderGeometry(0.55, 0.55, 0.09, 10).rotateZ(Math.PI / 2).rotateX(Math.PI / 10).translate(...hub), 3, 0, hub, 1, 1);
    for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
      f.add(new THREE.BoxGeometry(0.105, 0.87, 0.045).rotateX(angle).translate(...hub), 0, 0, hub, 1, 1);
    }
  }
  for (const x of [-0.28, 0.28]) {
    f.box([0.5, 0.44, 1.15], [x, 0.96, -0.05], 1);
    f.box([0.515, 0.455, 0.035], [x, 0.96, -0.26], 3);
  }
  return f.finish();
}

/** Attach with geometry.setAttribute('iAnim', anim), and likewise iTint0/1/2. */
export function createCrowdAttributes(count: number) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Crowd count must be a nonnegative integer');
  const attribute = (size: number, fill: number) => new THREE.InstancedBufferAttribute(new Float32Array(count * size).fill(fill), size).setUsage(THREE.DynamicDrawUsage);
  return { anim: attribute(4, 0), tint0: attribute(3, 1), tint1: attribute(3, 1), tint2: attribute(3, 1) };
}

/** Patch a dedicated crowd material; update userData.uTime.value once each frame (seconds).
 * iAnim.x is a phase offset; uTime advances cycles at a speed-dependent frequency.
 * Supply matching deformation to customDepthMaterial/customDistanceMaterial for animated shadows.
 */
export function patchCrowdMaterial(mat: THREE.MeshStandardMaterial, kind: 'person' | 'horse' | 'cart'): void {
  const time = { value: 0 };
  mat.userData.uTime = time;
  mat.vertexColors = true;
  mat.customProgramCacheKey = () => `npc-v2-${kind}`;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 iAnim;
attribute vec3 iTint0, iTint1, iTint2;
attribute vec4 aRig;
#define aPart aRig.x
#define aLimb aRig.y
#define aBend aRig.z
#define aWheel aRig.w
attribute vec3 aPivot;
uniform float uTime;
varying vec3 vNpcTint;
mat3 npcX(float a) { float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 npcY(float a) { float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
`).replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float npcSpeed = clamp(iAnim.y, 0., 1.);
float npcPhase = iAnim.x + uTime * mix(2., 9., npcSpeed);
float npcAngle = 0.;
float npcYaw = 0.;
float npcBob = 0.;
${kind === 'cart' ? `npcAngle = aWheel * (iAnim.x + uTime * npcSpeed * 6.);` : `
float npcSign = (aLimb == 1. || aLimb == 4.) ? 1. : -1.;
if (aLimb > 0.5 && aLimb < 4.5) npcAngle = sin(npcPhase) * npcSign * ${kind === 'person' ? '0.8' : '0.65'} * npcSpeed;
${kind === 'person' ? `
if (aLimb == 3. || aLimb == 4.) {
  npcAngle *= 0.65;
  if (iAnim.z > 0.5 && iAnim.z < 1.5 && aLimb == 4.)
    npcAngle = -0.8 + sin(uTime * 4. + iAnim.x) * 0.35 * aBend;
  if (iAnim.z > 1.5) npcAngle = -2.65 + sin(uTime * 1.5) * 0.04;
}` : ''}
npcAngle *= aBend;
if (aLimb == 5.) npcYaw = iAnim.w * aBend;
npcBob = (1. - npcSpeed) * sin(uTime * 1.8 + iAnim.x) * 0.006
  + npcSpeed * (1. - cos(npcPhase * 2.)) * 0.018;
`}
mat3 npcRotation = npcY(npcYaw) * npcX(npcAngle);
objectNormal = npcRotation * objectNormal;
#ifdef USE_TANGENT
  objectTangent = npcRotation * objectTangent;
#endif
`).replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = npcRotation * (transformed - aPivot) + aPivot;
transformed.y += npcBob;
vNpcTint = aPart < 0.5 ? iTint0 : (aPart < 2.5 ? iTint1 : iTint2);
`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNpcTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vNpcTint;');
  };
  mat.needsUpdate = true;
}
