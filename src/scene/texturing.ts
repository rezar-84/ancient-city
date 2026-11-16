import * as THREE from 'three'

export const RUNTIME_MATERIALS = ['limestone', 'travertine', 'marble', 'paving', 'plaster', 'rooftile', 'dirt', 'grass'] as const
export type RuntimeMaterial = typeof RUNTIME_MATERIALS[number]
export type RuntimeTextures = Record<RuntimeMaterial, { albedo: THREE.Texture; nr: THREE.Texture }>
/** Metres per repeat; use scale = 1 / RUNTIME_TILE_METRES[name]. */
export const RUNTIME_TILE_METRES: Record<RuntimeMaterial, number> = {
  limestone: 8, travertine: 4, marble: 4, paving: 4, plaster: 4, rooftile: 4, dirt: 4, grass: 4,
}

/** Load once at scene setup. Caller owns/disposes textures; failures dispose the entire batch.
 * Anisotropy 4 is clamped by Three to renderer capabilities. No per-frame work.
 */
export async function loadRuntimeTextures(): Promise<RuntimeTextures> {
  const loader = new THREE.TextureLoader(), loaded: THREE.Texture[] = []
  const result = {} as RuntimeTextures
  const outcomes = await Promise.allSettled(RUNTIME_MATERIALS.map(async name => {
    const pair = {} as RuntimeTextures[RuntimeMaterial]
    await Promise.allSettled((['albedo', 'nr'] as const).map(async kind => {
      const tex = await loader.loadAsync(`/tex/${name}_${kind}.jpg`)
      loaded.push(tex)
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.generateMipmaps = true
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.anisotropy = 4
      tex.colorSpace = kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      pair[kind] = tex
    })).then(states => {
      const failure = states.find(s => s.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    })
    result[name] = pair
  }))
  const failure = outcomes.find(s => s.status === 'rejected')
  if (failure?.status === 'rejected') {
    loaded.forEach(tex => tex.dispose())
    throw failure.reason
  }
  return result
}

/** Fragment-only chunk. Set triDetailWeight before sampling (see docs/codex/tex.md).
 * RG stores tangent XY in [0,1], positive Z reconstructed; B stores linear roughness.
 * triNormalRoughness shares the NR fetches; calling triNormal + triRoughness separately doubles them.
 * triBiplanar drops the least-facing axis, with deterministic ties. All outputs are linear/world space.
 */
export const TRIPLANAR_GLSL = /* glsl */ `
uniform sampler2D uTriAlbedo;
uniform sampler2D uTriNR;
uniform float uTriScale;
uniform float uTriNear;
uniform float uTriFar;
uniform float uTriStrength;
uniform float uTriSharpness;
uniform bool uTriBiplanar;
float triDetailWeight = 0.0;

float triFade(float viewDistance) {
  return (1.0 - smoothstep(uTriNear, uTriFar, viewDistance)) * uTriStrength;
}
vec3 triWeights(vec3 wn) {
  vec3 a = abs(normalize(wn));
  if (uTriBiplanar) {
    if (a.x <= a.y && a.x <= a.z) a.x = 0.0;
    else if (a.y <= a.z) a.y = 0.0;
    else a.z = 0.0;
  }
  vec3 w = pow(a, vec3(uTriSharpness));
  return w / max(w.x + w.y + w.z, 0.000001);
}
vec3 triSigns(vec3 n) { return step(vec3(0.0), n) * 2.0 - 1.0; }
vec3 triDecode(vec3 packedNR) {
  vec2 xy = packedNR.rg * 2.0 - 1.0;
  return normalize(vec3(xy, sqrt(max(0.0001, 1.0 - dot(xy, xy)))));
}
vec3 triAlbedo(sampler2D tex, vec3 wpos, vec3 wn, float scale) {
  if (triDetailWeight <= 0.0) return vec3(1.0);
  vec3 w = triWeights(wn), s = triSigns(wn), p = wpos * scale;
  vec3 c = vec3(0.0);
  if (w.x > 0.0) c += texture2D(tex, vec2(-s.x * p.z, p.y)).rgb * w.x;
  if (w.y > 0.0) c += texture2D(tex, vec2(p.x, -s.y * p.z)).rgb * w.y;
  if (w.z > 0.0) c += texture2D(tex, vec2(s.z * p.x, p.y)).rgb * w.z;
  return c;
}
vec4 triNormalRoughness(sampler2D nr, vec3 wpos, vec3 wn, float scale) {
  vec3 n = normalize(wn);
  if (triDetailWeight <= 0.0) return vec4(n, 1.0);
  vec3 w = triWeights(n), s = triSigns(n), p = wpos * scale;
  vec3 blended = vec3(0.0);
  float rough = 0.0;
  // Whiteout: add tangent XY to the projected base normal, multiply the normal-axis component.
  // Signed right-handed bases ensure a flat map reproduces wn on all six faces.
  if (w.x > 0.0) {
    vec3 packedNR = texture2D(nr, vec2(-s.x * p.z, p.y)).rgb;
    vec3 t = triDecode(packedNR);
    blended += vec3(n.x * t.z, n.y + t.y, n.z - s.x * t.x) * w.x;
    rough += packedNR.b * w.x;
  }
  if (w.y > 0.0) {
    vec3 packedNR = texture2D(nr, vec2(p.x, -s.y * p.z)).rgb;
    vec3 t = triDecode(packedNR);
    blended += vec3(n.x + t.x, n.y * t.z, n.z - s.y * t.y) * w.y;
    rough += packedNR.b * w.y;
  }
  if (w.z > 0.0) {
    vec3 packedNR = texture2D(nr, vec2(s.z * p.x, p.y)).rgb;
    vec3 t = triDecode(packedNR);
    blended += vec3(n.x + s.z * t.x, n.y + t.y, n.z * t.z) * w.z;
    rough += packedNR.b * w.z;
  }
  return vec4(normalize(blended), rough);
}
vec3 triNormal(sampler2D nr, vec3 wpos, vec3 wn, float scale) {
  return triNormalRoughness(nr, wpos, wn, scale).xyz;
}
float triRoughness(sampler2D nr, vec3 wpos, vec3 wn, float scale) {
  return triNormalRoughness(nr, wpos, wn, scale).w;
}
`

export interface TriplanarOptions {
  albedo: THREE.Texture
  nr: THREE.Texture
  scale: number
  near: number
  far: number
  strength: number
  /** Blend exponent, defaults to 4; supported range 1–16. */
  sharpness?: number
  /** Two projections instead of three. Defaults to false. */
  biplanar?: boolean
}
export interface TriplanarShader {
  uniforms: Record<string, THREE.IUniform>
  fragmentShader: string
}

/** Inject uniforms and declarations only: does NOT assume ownership of vW/vWN or existing shading.
 * Call once inside onBeforeCompile, after the existing replacements. Insert the explicit sampling
 * lines from docs/codex/tex.md at the desired color/normal/roughness stages. No vertex edits.
 * Far is capped at 120 metres; invalid ranges fail before modifying the shader.
 */
export function applyTriplanar(shader: TriplanarShader, opts: TriplanarOptions): void {
  const far = Math.min(opts.far, 120), sharpness = opts.sharpness ?? 4
  if (![opts.scale, opts.near, opts.far, opts.strength, sharpness].every(Number.isFinite)
    || opts.scale <= 0 || opts.near < 0 || opts.near >= far
    || opts.strength < 0 || opts.strength > 1 || sharpness < 1 || sharpness > 16) {
    throw new RangeError('Invalid triplanar scale, fade range, strength or sharpness')
  }
  const anchor = '#include <common>'
  if (!shader.fragmentShader.includes(anchor)) throw new Error('Triplanar requires the common fragment chunk')
  if (!shader.fragmentShader.includes('vec4 triNormalRoughness(')) {
    shader.fragmentShader = shader.fragmentShader.replace(anchor, anchor + '\n' + TRIPLANAR_GLSL)
  }
  Object.assign(shader.uniforms, {
    uTriAlbedo: { value: opts.albedo }, uTriNR: { value: opts.nr },
    uTriScale: { value: opts.scale }, uTriNear: { value: opts.near }, uTriFar: { value: far },
    uTriStrength: { value: opts.strength }, uTriSharpness: { value: sharpness },
    uTriBiplanar: { value: opts.biplanar ?? false },
  })
}
