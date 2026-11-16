import * as THREE from 'three';
import { waterUniforms } from './ripples';
export interface WaterMaterialOptions { kind: 'pool' | 'terrace' | 'basin' | 'sheet'; color?: string; fizz?: boolean }
export function createWaterMaterial(opts: WaterMaterialOptions): THREE.MeshPhysicalMaterial {
  const sheet = opts.kind === 'sheet';
  const material = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? '#ffffff', roughness: sheet ? 0.2 : 0.12, metalness: 0,
    ior: 1.333, specularIntensity: 1, envMapIntensity: 1.35,
    transparent: true, opacity: sheet ? 0.65 : 0.76, depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.forceSinglePass = true;
  material.customProgramCacheKey = () => `hierapolis-water-1-${opts.kind}-${!!opts.fizz}`;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, waterUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute float aDepth;
varying float vWaterDepth;
varying vec3 vWaterWorld;
varying vec2 vWaterUv;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vWaterDepth = aDepth;
vWaterUv = uv;
vec4 waterPosition = vec4(position, 1.0);
#ifdef USE_INSTANCING
waterPosition = instanceMatrix * waterPosition;
#endif
vWaterWorld = (modelMatrix * waterPosition).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime;
uniform vec4 uRipples[16];
varying float vWaterDepth;
varying vec3 vWaterWorld;
varying vec2 vWaterUv;
vec2 waterSlope(vec2 p) {
  vec2 slope = vec2(cos(p.x * 1.7 + p.y * 0.8 + uTime * 0.65), cos(p.y * 1.9 - p.x * 0.6 - uTime * 0.48)) * 0.035;
  slope += vec2(cos(p.x * 4.1 - p.y * 2.3 - uTime * 0.9), cos(p.y * 3.7 + p.x * 1.5 + uTime * 0.7)) * 0.016;
  for (int i = 0; i < 16; i++) {
    float age = uTime - uRipples[i].z;
    vec2 delta = p - uRipples[i].xy;
    float radius = length(delta);
    float ring = radius - age * 1.2;
    float envelope = exp(-ring * ring * 18.0) * (1.0 - smoothstep(0.0, 2.5, age)) * step(0.0, age);
    slope += delta / max(radius, 0.001) * cos(ring * 19.0) * envelope * uRipples[i].w * 0.16;
  }
  return slope;
}`).replace('#include <color_fragment>', `#include <color_fragment>
// Linear-space equivalents of #9fe3df and #2f8f9d.
vec3 waterTint = mix(vec3(0.347, 0.768, 0.738), vec3(0.028, 0.275, 0.337), 1.0 - exp(-max(vWaterDepth, 0.0) * 1.1));
float waterFoam = (1.0 - smoothstep(0.015, 0.08, vWaterDepth)) * (0.65 + 0.35 * sin(vWaterWorld.x * 9.0 + vWaterWorld.z * 7.0 + uTime));
${sheet ? `float streak = pow(0.5 + 0.5 * sin(vWaterUv.x * 95.0 + sin(vWaterUv.y * 22.0 + uTime * 5.0)), 6.0);
waterFoam = max(waterFoam, (1.0 - smoothstep(0.0, 0.18, vWaterUv.y)) * 0.9);
waterTint = mix(waterTint, vec3(0.9), streak * 0.55);
diffuseColor.a *= 0.45 + 0.55 * streak;` : ''}
diffuseColor.rgb *= mix(waterTint, vec3(0.94, 0.98, 1.0), waterFoam);
${opts.fizz ? `vec2 fizzCell = floor(vWaterWorld.xz * 20.0);
float fizzSeed = fract(sin(dot(fizzCell, vec2(127.1, 311.7))) * 43758.5453);
float fizz = step(0.985, fizzSeed) * pow(max(0.0, sin(uTime * 3.0 + fizzSeed * 100.0)), 14.0);
diffuseColor.rgb += fizz * 0.45;` : ''}
`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec2 waterGradient = waterSlope(vWaterWorld.xz);
${sheet ? 'waterGradient += vec2(sin(vWaterUv.x * 90.0 + uTime), cos(vWaterUv.y * 30.0 + uTime * 5.0)) * 0.08;' : ''}
vec3 waterPerturb = mat3(viewMatrix) * vec3(waterGradient.x, 0.0, waterGradient.y);
normal = normalize(normal + waterPerturb);
// MeshPhysicalMaterial supplies dielectric Fresnel environment reflection and sun glints
// through its IOR/specular BRDF, scene.environment and envMapIntensity.
`);
  };
  return material;
}
