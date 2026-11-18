import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { BUILDERS, createColonnadedStreet, createNecropolis, createWall, snapToTerrain } from './generators'
import { LANDMARKS } from '../content/landmarks'
import { PLAN } from '../content/plan'
import { timeGated, useApp } from '../store'
import { getMaterials } from './materials'
import { theatreScaenaeDetail } from './generators/house'
import { groundUniforms, sceneUniforms, setGroundData } from './Terrain'
import { MONUMENT_FOOTPRINTS, registerFootprint } from './footprints'

/** Patch shared building materials once: procedural masonry (staggered courses, recessed joints with bump relief,
 * per-block tint and roughness, chipped arrises), marble veining, column fluting, roof tiles (tegulae + imbrices
 * following the roof slope), weathering (rain streaks, dirt and moss near the ground, sun-bleached tops) and
 * plan-mode ink. All computed from world position plus a small terrain-height texture, so no texture downloads.
 * Surface relief is a derivative-based bump (no tangents needed) that fades out with distance. */
let patched = false
const STONE_PARAMS: Record<string, { course: number; block: number; joint: number; tint: number }> = {
  limestone: { course: 0.62, block: 1.45, joint: 0.2, tint: 0.09 },
  travertine: { course: 0.66, block: 1.6, joint: 0.22, tint: 0.1 },
  marble: { course: 1.1, block: 1.8, joint: 0.14, tint: 0.035 },
  plaster: { course: 0.0, block: 0.0, joint: 0.0, tint: 0.05 },
  ground: { course: 0.0, block: 0.0, joint: 0.0, tint: 0.08 },
}
const SHADER_COMMON = /* glsl */ `
uniform float uPlan;
uniform float uTime;
uniform sampler2D uGroundTex;
uniform vec4 uGroundXf;
varying vec3 vW;
varying vec3 vWN;
varying float vFlute;
float gBump = 0.0;
float gRough = 0.0;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float groundH(vec2 xz) { return texture2D(uGroundTex, xz * uGroundXf.xy + 0.5).r + uGroundXf.z; }
`
function patchMaterials() {
  if (patched) return
  patched = true
  const mats = getMaterials() as Record<string, THREE.MeshStandardMaterial>
  for (const [key, m] of Object.entries(mats)) {
    const sp = STONE_PARAMS[key]
    const roof = key === 'roofTile', water = key === 'water', marble = key === 'marble', plaster = key === 'plaster'
    if (marble) { m.roughness = 0.5; m.color.set('#f2ebe0') }
    if (key === 'limestone') { m.color.set('#d9c6a3'); m.roughness = 0.9 }
    if (key === 'travertine') { m.color.set('#e6d9c1'); m.roughness = 0.88 }
    if (plaster) { m.color.set('#e8d8bd'); m.roughness = 0.93 }
    if (roof) { m.color.set('#b0603c'); m.roughness = 0.72 }
    if (water) { m.color.set('#5fa9b8'); m.roughness = 0.04; m.opacity = 0.86; m.envMapIntensity = 1.4 }
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPlan = sceneUniforms.uPlan
      sh.uniforms.uTime = sceneUniforms.uTime
      sh.uniforms.uGroundTex = groundUniforms.uGroundTex
      sh.uniforms.uGroundXf = groundUniforms.uGroundXf
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aFlute;\nvarying vec3 vW;\nvarying vec3 vWN;\nvarying float vFlute;')
        .replace('#include <project_vertex>', `#include <project_vertex>
vec4 wp = vec4(transformed, 1.0);
vec3 wn = objectNormal;
#ifdef USE_INSTANCING
wp = instanceMatrix * wp;
mat3 imN = mat3(instanceMatrix);
wn = imN * (wn / vec3(dot(imN[0], imN[0]), dot(imN[1], imN[1]), dot(imN[2], imN[2])));
#endif
wp = modelMatrix * wp; vW = wp.xyz;
mat3 mmN = mat3(modelMatrix);
vWN = normalize(mmN * (wn / vec3(dot(mmN[0], mmN[0]), dot(mmN[1], mmN[1]), dot(mmN[2], mmN[2]))));
vFlute = aFlute;`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SHADER_COMMON)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float vert = 1.0 - abs(n.y);
  float dist = length(vViewPosition);
  float detail = (1.0 - smoothstep(70.0, 420.0, dist)) * (1.0 - uPlan);
  float pxW = length(fwidth(vW));
  float fineW = 1.0 - smoothstep(0.015, 0.05, pxW);
  vec2 uvW = vec2(abs(n.x) > abs(n.z) ? vW.z : vW.x, vW.y);
  vec2 uvH = vW.xz;
  float wear = vnoise(vW.xz * 0.35 + vW.y * 0.2) * 0.6 + vnoise(vW.xz * 2.1 + vW.y) * 0.4;
  float hg = vW.y - groundH(vW.xz);
  ${water ? `
  // gentle ripples so the basin catches the sun and sky
  vec2 q = vW.xz * 1.7;
  gBump = (sin(q.x + uTime * 1.3 + sin(q.y * 0.7)) + sin(q.y * 1.3 - uTime * 1.1 + q.x * 0.4)) * 0.004;
  ` : `
  ${sp && sp.course > 0.0 ? `
  float course = ${sp.course.toFixed(3)}, blockW = ${sp.block.toFixed(3)};
  vec2 uv = vert > 0.35 ? vec2(uvW.x / blockW, uvW.y / course) : uvH * vec2(1.0 / blockW, 1.0 / (blockW * 0.7));
  float row = floor(uv.y);
  uv.x += mod(row, 2.0) * 0.5 + (h21(vec2(row, 3.7)) - 0.5) * 0.3;
  vec2 cell = floor(uv); vec2 f = fract(uv);
  float isCol = step(0.5, vFlute);
  float jx = mix(min(f.x, 1.0 - f.x) * blockW, 9.0, isCol), jy = min(f.y, 1.0 - f.y) * course;
  float jd = min(jx, jy);
  float px = max(fwidth(uv.x) * blockW, fwidth(uv.y) * course); // metres per pixel
  float jFade = 1.0 - smoothstep(0.06, 0.3, px);
  float joint = (1.0 - smoothstep(0.018, 0.018 + max(0.02, px * 1.5), jd)) * jFade;
  // close-range only (coherent branch on distance): chipped arrises and tooling grain
  float chip = 0.0, fineN = 0.0;
  if (detail > 0.0) {
    float chipN = vnoise(vW.xz * 6.0 + vW.y * 6.0 + cell * 1.7);
    chip = (1.0 - smoothstep(0.02, 0.07 + chipN * 0.06, jd)) * step(0.6, chipN) * jFade;
    fineN = (vnoise(vW.xz * 11.0 + vW.y * 9.0) - 0.5) * 0.004 * fineW;
  }
  float tint = (h21(cell) - 0.5) * ${(sp.tint * 2).toFixed(3)};
  diffuseColor.rgb *= 1.0 + tint - joint * ${sp.joint.toFixed(3)} - chip * 0.1;
  gRough = (h21(cell + 7.1) - 0.5) * 0.18 + joint * 0.3;
  // pillowed block faces, recessed joints, knocked arrises, fine tooling grain
  gBump = smoothstep(0.0, 0.1, jd) * 0.014 - joint * 0.022 - chip * 0.012 + fineN;
  ` : sp ? `
  // lime plaster / packed earth: soft trowelled undulation
  diffuseColor.rgb *= 1.0 + (wear - 0.5) * ${(sp.tint * 2).toFixed(3)};
  if (detail > 0.0) gBump = (vnoise(vW.xz * 3.1 + vW.y * 2.3) - 0.5) * 0.01 + (vnoise(vW.xz * 13.0 + vW.y * 11.0) - 0.5) * 0.003 * fineW;
  gRough = (wear - 0.5) * 0.1;
  ` : ''}
  ${marble ? `
  // marble: soft grey veining and slight translucency warmth
  if (detail > 0.0) {
    float vn = vnoise(vW.xz * 0.45 + vW.y * 0.31) * 2.2 + vnoise(vW.zy * 1.6 + vW.x * 0.3);
    float vein = 1.0 - smoothstep(0.0, 0.06 + 0.04 * vn, abs(sin(vW.x * 0.6 + vW.y * 0.9 + vW.z * 0.45 + vn * 2.6)));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.81, 0.84), vein * 0.35 * detail);
  }
  ` : ''}
  ${sp && sp.course > 0.0 ? `
  // flutes on column shafts: 20 rounded grooves, darker in their hollows
  float fu = max(vFlute - 1.0, 0.0) * 20.0;
  float fFade = 1.0 - smoothstep(0.25, 0.6, fwidth(fu)); // derivative outside the branch
  if (vFlute > 0.5) {
    float fl = fract(fu);
    float prof = sqrt(max(0.0, 1.0 - pow(2.0 * fl - 1.0, 2.0)));
    gBump += -prof * 0.03 * fFade;
    diffuseColor.rgb *= 1.0 - prof * 0.07 * fFade;
  }` : ''}
  ${roof ? `
  // Roman tiles: flat tegulae with half-round imbrices over the joints, running down the roof slope
  vec2 dh = n.xz; float dl = length(dh);
  vec2 dir = dl > 0.08 ? dh / dl : vec2(0.0, 1.0);
  float across = dot(vW.xz, vec2(-dir.y, dir.x)) / 0.44;
  float along = dot(vW.xz, dir) / max(abs(n.y), 0.35) / 0.42;
  float ca = fract(across), cc = abs(ca - 0.5) * 2.0;
  float rowT = fract(along);
  float tFade = 1.0 - smoothstep(0.25, 0.7, fwidth(across));
  float ie = (1.0 - cc) / 0.26;
  float imb = sqrt(max(0.0, 1.0 - ie * ie));
  float tileId = h21(vec2(floor(across), floor(along)));
  diffuseColor.rgb *= mix(1.0, 0.86 + 0.2 * imb - 0.1 * smoothstep(0.82, 1.0, rowT), tFade);
  diffuseColor.rgb *= 0.9 + 0.2 * (tileId - 0.5) * tFade + 0.06;
  // lichen and soot patches on old roofs
  float lich = detail > 0.0 ? smoothstep(0.62, 0.9, vnoise(vW.xz * 0.8)) : 0.3;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.48, 0.44, 0.36) * dot(diffuseColor.rgb, vec3(0.33)) * 2.2, lich * 0.25);
  gBump = (imb * 0.05 + rowT * 0.018) * tFade;
  gRough = (tileId - 0.5) * 0.2 - imb * 0.08;
  // vertical faces of roof solids are gable ends / raised walls of lean-tos: lime plaster, not tiles
  float gableEnd = smoothstep(0.8, 0.92, vert);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.64, 0.48) * (0.92 + 0.12 * wear), gableEnd);
  gBump *= 1.0 - gableEnd; gRough += gableEnd * 0.2;` : ''}
  // weathering: rain streaks down walls, dirt and moss splash near the ground, sun-bleached tops
  float streak = smoothstep(0.55, 0.9, vnoise(vec2(uvW.x * 2.2, vW.y * 0.06 + uvW.x * 0.1)));
  diffuseColor.rgb *= 1.0 - vert * streak * 0.07;
  float dirt = (1.0 - smoothstep(0.0, 1.2 + wear * 1.4, hg)) * smoothstep(0.2, 0.6, vert);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.76, 0.69, 0.58), dirt * 0.75);
  float moss = (dirt * detail > 0.0) ? dirt * smoothstep(0.5, 0.8, vnoise(vW.xz * 0.7 + vW.y * 1.7)) : dirt * 0.25;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.37, 0.25), moss * 0.32);
  gRough += dirt * 0.1;
  diffuseColor.rgb *= 0.93 + 0.1 * wear + 0.04 * max(n.y, 0.0);
  gBump *= detail;
  `}
}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.29, 0.21, 0.15), uPlan * 0.9);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
${water ? '' : 'roughnessFactor = clamp(roughnessFactor + (vnoise(vW.xz * 1.7 + vW.y * 1.3) - 0.5) * 0.2 + gRough, 0.28, 1.0);'}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // derivative bump from the procedural height (Mikkelsen 2010), no tangents needed
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(gBump), dhy = dFdy(gBump);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  normal = normalize(abs(det) * normal - grad);
}`)
    }
    m.customProgramCacheKey = () => 'hier2-' + key
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
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = !c.userData.noShadow; c.receiveShadow = true } })
}

export function City({ terrain }: { terrain: Terrain }) {
  const root = useRef<THREE.Group>(null)

  const pieces = useMemo<Piece[]>(() => {
    setGroundData(terrain)
    patchMaterials()
    const out: Piece[] = []
    MONUMENT_FOOTPRINTS.length = 0
    // monuments
    for (const l of LANDMARKS) {
      if (!l.builder || !BUILDERS[l.builder]) continue
      let g: THREE.Group
      if (l.id === 'apollo') {
        g = new THREE.Group()
        g.name = 'Temple of Apollo'
        const hellenistic = BUILDERS.temple({ ...(l.builderOpts ?? {}), eraPhase: 'hellenistic', columnHeight: 7.5 })
        const roman = BUILDERS.temple({ ...(l.builderOpts ?? {}), eraPhase: 'roman' })
        g.add(hellenistic, roman)
        g.userData.eraPhases = { hellenistic, roman, splitYear: 190 }
      } else {
        g = BUILDERS[l.builder](l.builderOpts ?? {})
      }
      if (l.builder === 'theatre') {
        // Richer Severan stage front aligned with actual theatre options and open stage portals
        const sw = Number(l.builderOpts?.stageWidth ?? 70)
        const sd = Number(l.builderOpts?.stageDepth ?? 12)
        const sh = Number(l.builderOpts?.stageHeight ?? 20)
        const or = Number(l.builderOpts?.outerRadius ?? 51.5)
        const det = theatreScaenaeDetail(sw, sh)
        det.rotation.y = Math.PI
        det.position.set(0, 1.5, Math.max(13, or * 0.3) - sd / 2 - 0.71)
        g.add(det)
      }
      const yaw = THREE.MathUtils.degToRad(l.rotation ?? 0)
      let [x, z] = terrain.toLocal(l.lat, l.lon)
      // builderOpts.back: set the model back from the mapped point along its own axis, so a
      // street-facing monument (the Nymphaeum of the Tritons) stands beside the plateia, not on it
      const back = Number(l.builderOpts?.back ?? 0)
      if (back) { x -= Math.sin(yaw) * back; z -= Math.cos(yaw) * back }
      const box = new THREE.Box3().setFromObject(g)
      const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.35
      let baseY = l.builderOpts?.sink !== undefined
        ? terrain.heightAt(x, z) - Number(l.builderOpts.sink)
        : groundUnder(terrain, x, z, r)
      if (l.builder === 'frontinusGate' || l.builder === 'byzantineGate' || l.builder === 'temple') {
        baseY = terrain.heightAt(x, z)
      } else if (l.builder === 'agora' || l.builder === 'baths') {
        baseY = terrain.heightAt(x, z) + 0.8
      } else if (l.builder === 'martyrium') {
        baseY = terrain.heightAt(x, z) + 0.55
      } else if (l.builder === 'church') {
        baseY = terrain.heightAt(x, z) + (l.id === 'philip-church' ? 0.6 : 0.05)
      }
      if (l.builder === 'latrine') {
        // Place the walkable entrance at local +Z on the terrain at the
        // threshold. The lowest corner of this long plot is downhill.
        const threshold = Number(l.builderOpts?.width ?? 10) / 2
        baseY = terrain.heightAt(x + Math.sin(yaw) * threshold, z + Math.cos(yaw) * threshold)
      }
      g.position.set(x, baseY, z)
      g.rotation.y = yaw
      registerFootprint(box, x, z, yaw, l.id, l.built, l.until)
      g.userData.landmark = l.id
      shadowAll(g)
      out.push({ obj: g, built: l.built, until: l.until, id: l.id, flatten: true })
    }
    // the Sacred Pool basin (built by Water): keep houses and the crowd out of it
    const pool = LANDMARKS.find((l) => l.id === 'antique-pool')
    if (pool) {
      const [px, pz] = terrain.toLocal(pool.lat, pool.lon)
      registerFootprint(new THREE.Box3(new THREE.Vector3(-17, 0, -13.5), new THREE.Vector3(17, 3, 13.5)), px, pz, 0, pool.id, pool.built, pool.until)
    }
    // colonnaded streets: precompute segment axes so adjacent sections keep intersecting porticoes clear
    const colSegs: Array<{ ax: number; az: number; dx: number; dz: number; len: number; built: number; until?: number }> = []
    for (const st of PLAN.streets.filter((s) => s.colonnade)) {
      for (let i = 1; i < st.line.length; i++) {
        const [ax, az] = terrain.toLocal(...st.line[i - 1])
        const [bx, bz] = terrain.toLocal(...st.line[i])
        const len = Math.hypot(bx - ax, bz - az)
        if (len > 0.1) colSegs.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, len, built: st.built ?? 80, until: st.until })
      }
    }
    colSegs.forEach((seg, segIdx) => {
      const ax = seg.ax, az = seg.az, bx = ax + seg.dx * seg.len, bz = az + seg.dz * seg.len, len = seg.len
      // split long segments into ~60 m pieces that each follow the slope
      const parts = Math.max(1, Math.round(len / 60))
      for (let k = 0; k < parts; k++) {
        const t0 = k / parts, t1 = (k + 1) / parts
        const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2
        const ry = Math.atan2(bx - ax, bz - az), cr = Math.cos(ry), sr = Math.sin(ry)
        // leave the shop wall out where a monument stands behind the portico or another street stretch crosses
        const open = (lx: number, lz: number) => {
          const wx = cx + lx * cr + lz * sr, wz = cz - lx * sr + lz * cr
          const isBackWall = Math.abs(lx) > 10
          if (isBackWall && MONUMENT_FOOTPRINTS.some((f) => f.contains(wx, wz, 0.8))) return true
          return colSegs.some((other, oi) => {
            if (oi === segIdx) return false
            const along = (wx - other.ax) * other.dx + (wz - other.az) * other.dz
            if (along < -6 || along > other.len + 6) return false
            const perp = Math.abs((wx - other.ax) * other.dz - (wz - other.az) * other.dx)
            return isBackWall ? perp < 12.8 : (perp < 6.8 || (perp > 8.1 && perp < 12.5))
          })
        }
        const g = createColonnadedStreet({ length: len / parts + 0.5, open })
        // Match the height of both road ends. A level foundation at the
        // midpoint presents a vertical face across the gateway on a slope.
        const y0 = terrain.heightAt(ax + (bx - ax) * t0, az + (bz - az) * t0)
        const y1 = terrain.heightAt(ax + (bx - ax) * t1, az + (bz - az) * t1)
        const grade = (y1 - y0) / (len / parts)
        const incline = new THREE.Matrix4().set(
          1, 0, 0, 0, 0, 1, grade, 0, 0, 0, 1, 0, 0, 0, 0, 1)
        // Put the slope on a child so plan-mode scaling still acts on the whole section.
        const section = new THREE.Group()
        g.matrix.copy(incline)
        g.matrixAutoUpdate = false
        section.add(g)
        section.position.set(cx, (y0 + y1) / 2 - 0.3, cz)
        section.rotation.y = ry
        shadowAll(g)
        out.push({ obj: section, built: seg.built, until: seg.until, flatten: true })
      }
    })
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

  useEffect(() => () => pieces.forEach((p) => p.obj.traverse((c) => {
    const m = c as THREE.Mesh
    m.geometry?.dispose()
    if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose()
  })), [pieces])

  // plan mode: flatten to footprints; today mode: shrink to ruin stubs (or hide under the photo mesh)
  const flat = useRef(1)
  useFrame((_, dt) => {
    const { mode, era, tiles, year } = useApp.getState()
    const target = mode !== 'plan' && era === 'today' ? 0.3 : 1
    const k = 1 - Math.exp(-dt * 2.5)
    flat.current += (target - flat.current) * k
    const gated = timeGated(mode)
    for (const p of pieces) {
      if (p.flatten) p.obj.scale.y = flat.current
      p.obj.visible = !gated || (year >= p.built && (p.until === undefined || year <= p.until))
      const phases = p.obj.userData.eraPhases as { hellenistic: THREE.Object3D; roman: THREE.Object3D; splitYear: number } | undefined
      if (phases) {
        phases.hellenistic.visible = gated && year < phases.splitYear
        phases.roman.visible = !gated || year >= phases.splitYear
      }
    }
    getMaterials().roofTile.visible = flat.current > 0.4
    if (root.current) root.current.visible = !(era === 'today' && tiles === 'ready' && mode !== 'plan')
  })

  return (
    <group ref={root} name="city-root">
      {pieces.map((p, i) => <primitive key={i} object={p.obj} />)}
    </group>
  )
}
