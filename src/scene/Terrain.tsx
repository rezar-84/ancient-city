import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Terrain as TerrainData } from './terrainData'
import { useApp } from '../store'

/** Shared uniforms so other materials (buildings) can follow plan mode. */
export const sceneUniforms = {
  uAncient: { value: 1 },
  uPlan: { value: 0 },
  uTime: { value: 0 },
}

/** Terrain heights as a small half-float texture, so building shaders know their height above ground
 * (dirt, moss and splash darkening near the foot of walls). uv = xz * xf.xy + 0.5, height = r + xf.z. */
export const groundUniforms = {
  uGroundTex: { value: null as THREE.DataTexture | null },
  uGroundXf: { value: new THREE.Vector4() },
}
let groundFor: TerrainData | null = null
export function setGroundData(data: TerrainData) {
  if (groundFor === data) return
  groundFor = data
  const { meta, heights } = data, g = meta.grid
  const mid = (meta.maxH - meta.minH) / 2
  const half = new Uint16Array(g * g)
  for (let i = 0; i < g * g; i++) half[i] = THREE.DataUtils.toHalfFloat(heights[i] - meta.minH - mid)
  const tex = new THREE.DataTexture(half, g, g, THREE.RedFormat, THREE.HalfFloatType)
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  groundUniforms.uGroundTex.value?.dispose()
  groundUniforms.uGroundTex.value = tex
  groundUniforms.uGroundXf.value.set((g - 1) / (g * meta.widthM), (g - 1) / (g * meta.depthM), mid, 0)
}

const isSmall = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700

export function Terrain({ data }: { data: TerrainData }) {
  const { meta, heights } = data
  const [tex, texAncient] = useTexture(isSmall ? ['/terrain/sat_2k.jpg', '/terrain/sat_ancient_2k.jpg'] : ['/terrain/sat.jpg', '/terrain/sat_ancient.jpg'])
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy())
  for (const t of [tex, texAncient]) {
    const a = Math.min(16, Math.max(4, maxAniso))
    if (t.anisotropy !== a || t.colorSpace !== THREE.SRGBColorSpace) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = a; t.needsUpdate = true }
  }

  const geometry = useMemo(() => {
    const g = meta.grid
    const geo = new THREE.PlaneGeometry(meta.widthM, meta.depthM, g - 1, g - 1)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i] - meta.minH)
    geo.computeVertexNormals()
    return geo
  }, [meta, heights])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uAncient = sceneUniforms.uAncient
      shader.uniforms.uPlan = sceneUniforms.uPlan
      shader.uniforms.uTime = sceneUniforms.uTime
      shader.uniforms.uMapAncient = { value: texAncient }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vWPos;
uniform float uAncient;
uniform float uPlan;
uniform float uTime;
uniform sampler2D uMapAncient;
float tBump = 0.0;
float tRough = 1.0;
float th21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th21(i), th21(i + vec2(1, 0)), f.x), mix(th21(i + vec2(0, 1)), th21(i + vec2(1, 1)), f.x), f.y); }
float contour(float h, float step, float w) {
  float f = abs(fract(h / step - 0.5) - 0.5) / fwidth(h / step);
  return 1.0 - smoothstep(0.0, w, f);
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  // ancient: modern buildings/roads/pools painted out (sat_ancient), warm painterly grade, travertine whites lifted
  vec3 anc = texture2D(uMapAncient, vMapUv).rgb;
  float la = dot(anc, vec3(0.299, 0.587, 0.114));
  vec3 warm = mix(vec3(la), anc, 0.7) * vec3(1.06, 1.0, 0.88);
  warm = mix(warm, vec3(0.97, 0.95, 0.9), smoothstep(0.5, 0.75, la) * 0.5);
  c = mix(c, warm, uAncient);
  // close-range detail the 0.8 m/px imagery lacks: soil/rock grain, travertine sheen, pools that glint
  float dist = length(vViewPosition);
  float near = (1.0 - smoothstep(120.0, 900.0, dist)) * (1.0 - uPlan);
  float l0 = dot(c, vec3(0.299, 0.587, 0.114));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  // each octave fades once its period approaches a pixel (no shimmering speckle at distance)
  float px = length(fwidth(vWPos.xz));
  float w1 = 1.0 - smoothstep(0.08, 0.25, px * 0.21), w2 = 1.0 - smoothstep(0.08, 0.25, px * 1.3), w3 = 1.0 - smoothstep(0.08, 0.25, px * 5.7);
  float n1 = 0.5, n2 = 0.5, n3 = 0.5;
  if (near > 0.0) { // coherent branch: only the close-up ring pays for the noise
    n1 = mix(0.5, tnoise(vWPos.xz * 0.21), w1); n2 = mix(0.5, tnoise(vWPos.xz * 1.3 + 7.0), w2); n3 = mix(0.5, tnoise(vWPos.xz * 5.7 - 3.0), w3);
  }
  float grain = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;
  float trav = smoothstep(0.55, 0.78, l0) * (1.0 - smoothstep(0.08, 0.2, sat));
  float pool = smoothstep(0.07, 0.15, c.b - c.r) * smoothstep(0.0, 0.04, c.g - c.r) * smoothstep(0.35, 0.55, l0);
  c *= mix(1.0, 0.82 + 0.36 * grain, near * (1.0 - trav * 0.6) * (1.0 - pool));
  c = mix(c, c * 1.03 + vec3(0.015, 0.014, 0.012), trav * (1.0 - uPlan));
  tBump = (grain * 0.9 * (1.0 - trav * 0.5) + (n3 - 0.5) * 0.25) * near * (1.0 - pool);
  // travertine terraces: rippled rimstone, a little satin; pools: calm water with slow ripples
  tBump += trav * (1.0 - pool) * near * abs(sin(vWPos.y * 2.2 + n1 * 3.0)) * 0.12;
  vec2 q = vWPos.xz * 0.9;
  tBump += pool * (sin(q.x + uTime * 0.9 + sin(q.y * 0.6)) + sin(q.y * 1.2 - uTime * 0.7)) * 0.02 * (1.0 - smoothstep(200.0, 1600.0, dist));
  tRough = mix(mix(0.97, 0.62, trav), 0.08, pool);
  tRough = mix(tRough, 1.0, uPlan);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // plan grade: parchment + contour lines (5 m minor, 25 m major)
  vec3 parch = vec3(0.937, 0.886, 0.769) * (0.82 + 0.25 * l);
  float minor = contour(vWPos.y, 5.0, 1.0) * 0.18;
  float major = contour(vWPos.y, 25.0, 1.4) * 0.45;
  parch = mix(parch, vec3(0.42, 0.3, 0.2), max(minor, major));
  c = mix(c, parch, uPlan);
  diffuseColor.rgb = c;
}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = tRough;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(tBump), dhy = dFdy(tBump);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, diffuseColor.rgb * 0.55, uPlan);
reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, diffuseColor.rgb * 0.45, uPlan);`)
    }
    return m
  }, [tex, texAncient])

  const skirt = useMemo(() => buildSkirt(data), [data])

  return (
    <group>
      <mesh name="terrain" geometry={geometry} material={material} receiveShadow />
      <mesh geometry={skirt}>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Diorama "cut earth" walls around the terrain edge, with strata bands. */
function buildSkirt({ meta, heights }: TerrainData) {
  const g = meta.grid, W = meta.widthM, D = meta.depthM, bottom = -70
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const strata = [new THREE.Color('#6b543c'), new THREE.Color('#7d6446'), new THREE.Color('#5a4532'), new THREE.Color('#8a7152')]
  const edge = (pts: Array<[number, number, number]>) => {
    const base = pos.length / 3
    const bands = 6
    pts.forEach(([x, z, h]) => {
      for (let b = 0; b <= bands; b++) {
        const y = h + (bottom - h) * (b / bands)
        pos.push(x, y, z)
        const c = strata[(b + Math.floor((y + 500) / 23)) % strata.length]
        const dark = 0.75 + 0.25 * (1 - b / bands)
        col.push(c.r * dark, c.g * dark, c.b * dark)
      }
    })
    for (let i = 0; i < pts.length - 1; i++)
      for (let b = 0; b < bands; b++) {
        const a = base + i * (bands + 1) + b, c2 = a + bands + 1
        idx.push(a, a + 1, c2, c2, a + 1, c2 + 1)
      }
  }
  const H = (i: number, j: number) => heights[j * g + i] - meta.minH
  const X = (i: number) => -W / 2 + (i / (g - 1)) * W
  const Z = (j: number) => -D / 2 + (j / (g - 1)) * D
  const n: Array<[number, number, number]> = [], s: Array<[number, number, number]> = []
  const w: Array<[number, number, number]> = [], e: Array<[number, number, number]> = []
  for (let i = 0; i < g; i++) { n.push([X(g - 1 - i), Z(0), H(g - 1 - i, 0)]); s.push([X(i), Z(g - 1), H(i, g - 1)]) }
  for (let j = 0; j < g; j++) { w.push([X(0), Z(j), H(0, j)]); e.push([X(g - 1), Z(g - 1 - j), H(g - 1, g - 1 - j)]) }
  ;[n, s, w, e].forEach(edge)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Animates the shared grading uniforms toward the current mode/era. */
export function GradeAnimator() {
  const era = useApp((s) => s.era)
  const mode = useApp((s) => s.mode)
  const t = useRef({ a: 1, p: 0 })
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3)
    t.current.a += ((era === 'ancient' ? 1 : 0) - t.current.a) * k
    t.current.p += ((mode === 'plan' ? 1 : 0) - t.current.p) * k
    sceneUniforms.uAncient.value = t.current.a
    sceneUniforms.uPlan.value = t.current.p
    sceneUniforms.uTime.value += dt
  })
  return null
}
