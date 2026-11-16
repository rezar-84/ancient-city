import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MaterialKey } from '../materials';

export interface VegetationParts { parts: Array<{ key: MaterialKey | 'foliage'; geometry: THREE.BufferGeometry }> }
let leafTexture: THREE.DataTexture | undefined;
/** Shared deterministic alpha map; no DOM, canvas, image loads or random global state. */
function foliageTexture(): THREE.DataTexture {
  if (leafTexture) return leafTexture;
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 1729;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const blobs = Array.from({ length: 85 }, () => {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 0.72;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r: 0.055 + random() * 0.16 };
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    let alpha = 0;
    for (const b of blobs) {
      const d = Math.hypot((u - b.x) / b.r, (v - b.y) / (b.r * 0.65));
      alpha = Math.max(alpha, THREE.MathUtils.clamp((1 - d) * 8, 0, 1));
    }
    const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(alpha * 255);
  }
  leafTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  leafTexture.magFilter = THREE.LinearFilter; leafTexture.minFilter = THREE.LinearMipmapLinearFilter;
  leafTexture.generateMipmaps = true; leafTexture.needsUpdate = true; return leafTexture;
}
/** Texture is shared: dispose individual materials, but keep their map alive while other foliage uses it. */
export function createFoliageMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, map: foliageTexture(), alphaTest: 0.45,
    side: THREE.DoubleSide, roughness: 0.95, vertexColors: true });
}
function prepared(source: THREE.BufferGeometry, sway = false) {
  const g = source.index ? source.toNonIndexed() : source;
  if (g !== source) source.dispose();
  const count = g.getAttribute('position').count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  if (sway) {
    const positions = g.getAttribute('position'), values = new Float32Array(count);
    for (let i = 0; i < count; i++) values[i] = THREE.MathUtils.clamp(positions.getY(i) / 0.35, 0, 1);
    g.setAttribute('aSway', new THREE.BufferAttribute(values, 1));
  }
  return g;
}
function merged(gs: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(gs, false); gs.forEach(g => g.dispose());
  if (!geometry) throw new Error('Cannot merge vegetation');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
function card(w: number, h: number, x: number, y: number, z: number, angle: number, sway = false) {
  return prepared(new THREE.PlaneGeometry(w, h).rotateY(angle).translate(x, y, z), sway);
}
function tree(height: number, kind: 'cypress' | 'olive' | 'plane'): VegetationParts {
  if (!Number.isFinite(height) || height <= 0) throw new RangeError('Tree height must be positive and finite');
  const oliveTree = kind === 'olive', narrow = kind === 'cypress';
  const trunkHeight = height * (narrow ? 0.3 : 0.6), radius = height * (narrow ? 0.025 : 0.035);
  const trunks = [prepared(new THREE.CylinderGeometry(radius * 0.7, radius, trunkHeight, 6).translate(0, trunkHeight / 2, 0))];
  if (!narrow) {
    for (const sign of [-1, 1]) trunks.push(prepared(new THREE.CylinderGeometry(radius * 0.35, radius * 0.7, height * 0.3, 5)
      .rotateZ(sign * 0.65).translate(-sign * height * 0.08, height * 0.54, 0)));
  }
  const cards: THREE.BufferGeometry[] = [];
  if (narrow) {
    // Four tapered silhouettes keep the recognizable cypress outline at every azimuth.
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-height * 0.075, height * 0.2, 0, height * 0.075, height * 0.2, 0, 0, height, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      g.computeVertexNormals(); g.rotateY(i * Math.PI / 4); cards.push(prepared(g));
    }
  } else {
    const count = oliveTree ? 8 : 10;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399963, ring = i < 2 ? 0 : height * 0.18;
      cards.push(card(height * 0.55, height * 0.43, Math.cos(a) * ring,
        height * (i < 2 ? 0.785 : 0.66), Math.sin(a) * ring, a));
    }
  }
  return { parts: [{ key: 'ground', geometry: merged(trunks) }, { key: 'foliage', geometry: merged(cards) }] };
}
export function cypress(height = 9): VegetationParts { return tree(height, 'cypress'); }
export function olive(height = 4.5): VegetationParts { return tree(height, 'olive'); }
export function plane(height = 11): VegetationParts { return tree(height, 'plane'); }
export function shrub(): VegetationParts {
  return { parts: [{ key: 'foliage', geometry: merged(Array.from({ length: 3 }, (_, i) => card(1, 1, 0, 0.5, 0, i * Math.PI / 3))) }] };
}
export function grassTuft(): VegetationParts {
  const geometry = merged(Array.from({ length: 3 }, (_, i) => card(0.12, 0.35, 0, 0.175, 0, i * Math.PI / 3, true)));
  // Conservative bound for the shader's maximum horizontal displacement.
  geometry.boundingBox!.expandByScalar(0.08); geometry.computeBoundingSphere(); geometry.boundingSphere!.radius += 0.08;
  return { parts: [{ key: 'foliage', geometry }] };
}
/** Patch once; update mat.userData.uTime.value with elapsed seconds. Use on grass only.
 * Shadow depth/distance materials need the same patch for animated shadow silhouettes.
 */
export function patchSwayMaterial(mat: THREE.MeshStandardMaterial): void {
  if (mat.userData.foliageSwayPatched) return;
  mat.userData.foliageSwayPatched = true;
  const time = { value: 0 }; mat.userData.uTime = time;
  const previous = mat.onBeforeCompile, previousKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer); shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\nattribute float aSway;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 swayAnchor = vec3(0.0);
      #ifdef USE_INSTANCING
        swayAnchor = instanceMatrix[3].xyz;
      #endif
      float swayPhase = uTime * 1.8 + dot(swayAnchor.xz, vec2(0.73, 0.51));
      transformed.x += sin(swayPhase + position.y * 2.0) * 0.065 * aSway;
      transformed.z += cos(swayPhase * 0.83) * 0.03 * aSway;
    `);
  };
  mat.customProgramCacheKey = () => previousKey + '|foliage-sway-v1'; mat.needsUpdate = true;
}
