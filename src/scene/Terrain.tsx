import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Terrain as TerrainData } from './terrainData'
import { useApp } from '../store'

/** Shared uniforms so other materials (buildings) can follow plan mode. */
export const sceneUniforms = {
  uAncient: { value: 1 },
  uPlan: { value: 0 },
}

const isSmall = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700

export function Terrain({ data }: { data: TerrainData }) {
  const { meta, heights } = data
  const [tex, texAncient] = useTexture(isSmall ? ['/terrain/sat_2k.jpg', '/terrain/sat_ancient_2k.jpg'] : ['/terrain/sat.jpg', '/terrain/sat_ancient.jpg'])
  for (const t of [tex, texAncient]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8 }

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
      shader.uniforms.uMapAncient = { value: texAncient }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vWPos;
uniform float uAncient;
uniform float uPlan;
uniform sampler2D uMapAncient;
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
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // plan grade: parchment + contour lines (5 m minor, 25 m major)
  vec3 parch = vec3(0.937, 0.886, 0.769) * (0.82 + 0.25 * l);
  float minor = contour(vWPos.y, 5.0, 1.0) * 0.18;
  float major = contour(vWPos.y, 25.0, 1.4) * 0.45;
  parch = mix(parch, vec3(0.42, 0.3, 0.2), max(minor, major));
  c = mix(c, parch, uPlan);
  diffuseColor.rgb = c;
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
      <mesh geometry={geometry} material={material} receiveShadow />
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
  })
  return null
}
