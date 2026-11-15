import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { BUILDERS, createColonnadedStreet, createNecropolis, createWall, snapToTerrain } from './generators'
import { LANDMARKS } from '../content/landmarks'
import { PLAN } from '../content/plan'
import { useApp } from '../store'
import { getMaterials } from './materials'
import { sceneUniforms } from './Terrain'
import { MONUMENT_FOOTPRINTS, registerFootprint } from './footprints'

/** Patch shared building materials once: procedural masonry (courses + joints + per-block tint + weathering),
 * roof-tile channels, and plan-mode ink. All computed from world position, so no texture downloads. */
let patched = false
const STONE_PARAMS: Record<string, { course: number; block: number; joint: number; tint: number }> = {
  limestone: { course: 0.55, block: 1.3, joint: 0.22, tint: 0.09 },
  travertine: { course: 0.6, block: 1.5, joint: 0.25, tint: 0.1 },
  marble: { course: 0.9, block: 1.8, joint: 0.1, tint: 0.04 },
  plaster: { course: 0.0, block: 0.0, joint: 0.0, tint: 0.05 },
  ground: { course: 0.0, block: 0.0, joint: 0.0, tint: 0.08 },
}
function patchMaterials() {
  if (patched) return
  patched = true
  const mats = getMaterials() as Record<string, THREE.MeshStandardMaterial>
  for (const [key, m] of Object.entries(mats)) {
    const sp = STONE_PARAMS[key]
    const roof = key === 'roofTile'
    if (key === 'marble') { m.roughness = 0.55; m.color.set('#f1eadf') }
    if (key === 'limestone') m.color.set('#dccaa8')
    if (key === 'travertine') m.color.set('#e8dcc6')
    if (roof) { m.color.set('#b0603c'); m.roughness = 0.75 }
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPlan = sceneUniforms.uPlan
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;')
        .replace('#include <project_vertex>', `#include <project_vertex>
vec4 wp = vec4(transformed, 1.0);
vec3 wn = objectNormal;
#ifdef USE_INSTANCING
wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
#endif
wp = modelMatrix * wp; vW = wp.xyz; vWN = normalize(mat3(modelMatrix) * wn);`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uPlan;
varying vec3 vW;
varying vec3 vWN;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  // in-plane coordinates: u along the wall, v up (walls); xz for floors/roofs
  float vert = 1.0 - abs(n.y);
  vec2 uvW = vec2(abs(n.x) > abs(n.z) ? vW.z : vW.x, vW.y);
  vec2 uvH = vW.xz;
  float wear = vnoise(vW.xz * 0.35 + vW.y * 0.2) * 0.6 + vnoise(vW.xz * 2.1 + vW.y) * 0.4;
  ${sp && sp.course > 0.0 ? `
  float course = ${sp.course.toFixed(3)}, blockW = ${sp.block.toFixed(3)};
  vec2 uv = mix(uvH * vec2(1.0 / blockW, 1.0 / (blockW * 0.7)), vec2(uvW.x / blockW, uvW.y / course), step(0.35, vert));
  float row = floor(uv.y);
  uv.x += mod(row, 2.0) * 0.5;
  vec2 cell = floor(uv); vec2 f = fract(uv);
  float jx = min(f.x, 1.0 - f.x) * blockW, jy = min(f.y, 1.0 - f.y) * course;
  float joint = 1.0 - smoothstep(0.015, 0.045, min(jx, jy));
  float tint = (h21(cell) - 0.5) * ${(sp.tint * 2).toFixed(3)};
  diffuseColor.rgb *= 1.0 + tint - joint * ${sp.joint.toFixed(3)};` : sp ? `
  diffuseColor.rgb *= 1.0 + (wear - 0.5) * ${(sp.tint * 2).toFixed(3)};` : ''}
  ${roof ? `
  float ch = abs(fract((abs(n.x) > abs(n.z) ? vW.z : vW.x) / 0.42) - 0.5) * 2.0;
  float rowR = fract(vW.y / 0.35 + (abs(n.x) > abs(n.z) ? vW.x : vW.z) * 0.0);
  diffuseColor.rgb *= 0.86 + 0.18 * smoothstep(0.0, 0.7, 1.0 - ch) - 0.08 * smoothstep(0.85, 1.0, rowR);
  diffuseColor.rgb *= 0.92 + 0.16 * (h21(floor(vW.xz / 0.42)) - 0.5);` : ''}
  // weathering: darker, slightly greenish near the ground and in noise patches
  float ground = 1.0 - smoothstep(0.0, 3.5, vW.y - (vW.y - 0.0));
  diffuseColor.rgb *= 0.93 + 0.1 * wear;
}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.29, 0.21, 0.15), uPlan * 0.9);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (vnoise(vW.xz * 1.7 + vW.y * 1.3) - 0.5) * 0.25, 0.25, 1.0);`)
    }
    m.customProgramCacheKey = () => 'hier-' + key
    m.needsUpdate = true
  }
}

interface Piece { obj: THREE.Object3D; built: number; until?: number; id?: string; flatten: boolean }

/** Lowest terrain height under a rectangular footprint (so foundations never float). */
function groundUnder(t: Terrain, x: number, z: number, r: number) {
  let h = Infinity
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, r * 0.7]])
    h = Math.min(h, t.heightAt(x + dx, z + dz))
  return h
}

function shadowAll(o: THREE.Object3D) {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true } })
}

export function City({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const tiles = useApp((s) => s.tiles)
  const year = useApp((s) => s.year)
  const root = useRef<THREE.Group>(null)

  const pieces = useMemo<Piece[]>(() => {
    patchMaterials()
    const out: Piece[] = []
    MONUMENT_FOOTPRINTS.length = 0
    // monuments
    for (const l of LANDMARKS) {
      if (!l.builder || !BUILDERS[l.builder]) continue
      const g = BUILDERS[l.builder](l.builderOpts ?? {})
      const [x, z] = terrain.toLocal(l.lat, l.lon)
      const box = new THREE.Box3().setFromObject(g)
      const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.35
      const yaw = THREE.MathUtils.degToRad(l.rotation ?? 0)
      g.position.set(x, l.builderOpts?.sink !== undefined ? terrain.heightAt(x, z) - Number(l.builderOpts.sink) : groundUnder(terrain, x, z, r), z)
      g.rotation.y = yaw
      registerFootprint(box, x, z, yaw)
      g.userData.landmark = l.id
      shadowAll(g)
      out.push({ obj: g, built: l.built, until: l.until, id: l.id, flatten: true })
    }
    // colonnaded streets
    for (const st of PLAN.streets.filter((s) => s.colonnade)) {
      for (let i = 1; i < st.line.length; i++) {
        const [ax, az] = terrain.toLocal(...st.line[i - 1])
        const [bx, bz] = terrain.toLocal(...st.line[i])
        const len = Math.hypot(bx - ax, bz - az)
        // split long segments into ~60 m pieces that each follow the slope
        const parts = Math.max(1, Math.round(len / 60))
        for (let k = 0; k < parts; k++) {
          const t0 = k / parts, t1 = (k + 1) / parts
          const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2
          const g = createColonnadedStreet({ length: len / parts + 0.5 })
          g.position.set(cx, terrain.heightAt(cx, cz) - 0.3, cz)
          g.rotation.y = Math.atan2(bx - ax, bz - az)
          shadowAll(g)
          out.push({ obj: g, built: st.built ?? 80, until: st.until, flatten: true })
        }
      }
    }
    // city walls (follow terrain)
    for (const w of PLAN.walls) {
      const pts = w.map(([la, lo]) => terrain.toLocal(la, lo))
      const g = createWall(pts, { heightAt: terrain.heightAt })
      const o = g.userData.origin as { x: number; z: number } | undefined
      if (o) g.position.set(o.x, 0, o.z)
      shadowAll(g)
      out.push({ obj: g, built: PLAN.wallsBuilt, until: PLAN.wallsUntil, flatten: false })
    }
    // necropoleis
    PLAN.zones.filter((z) => z.kind === 'necropolis').forEach((zn, i) => {
      const loc = zn.poly.map(([la, lo]) => terrain.toLocal(la, lo))
      const xs = loc.map((p) => p[0]), zs = loc.map((p) => p[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
      const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs)
      const density = (w * d) / 120000
      const g = createNecropolis({ area: { w, d }, seed: 7 + i, tumuli: Math.round(30 * density), sarcophagi: Math.round(220 * density), houseTombs: Math.round(45 * density) })
      g.position.set(cx, 0, cz)
      snapToTerrain(g, terrain.heightAt, { x: cx, z: cz })
      shadowAll(g)
      out.push({ obj: g, built: -150, until: 600, flatten: false })
    })
    return out
  }, [terrain])

  useEffect(() => () => pieces.forEach((p) => p.obj.traverse((c) => (c as THREE.Mesh).geometry?.dispose())), [pieces])

  // plan mode: flatten to footprints; today mode: shrink to ruin stubs (or hide under the photo mesh)
  const flat = useRef(1)
  useFrame((_, dt) => {
    const target = mode !== 'plan' && era === 'today' ? 0.3 : 1
    const k = 1 - Math.exp(-dt * 2.5)
    flat.current += (target - flat.current) * k
    for (const p of pieces) {
      if (p.flatten) p.obj.scale.y = flat.current
      p.obj.visible = mode !== 'plan' || (year >= p.built && (p.until === undefined || year <= p.until))
    }
    getMaterials().roofTile.visible = flat.current > 0.4
    if (root.current) root.current.visible = !(era === 'today' && tiles === 'ready' && mode !== 'plan')
  })

  return (
    <group ref={root}>
      {pieces.map((p, i) => <primitive key={i} object={p.obj} />)}
    </group>
  )
}
