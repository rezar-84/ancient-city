import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { LANDMARKS } from '../content/landmarks'
import { useApp, timeGated } from '../store'
import { gridFrame } from '../walk/spots'
import { standPoint } from '../walk/FastTravel'
import { SKY } from './sky'
import { sceneUniforms } from './Terrain'
import { isLight } from './quality'

/**
 * Torches lit from late golden hour: bronze tripod braziers along the plateia and in pairs at the
 * gates, temples, theatre and churches. Flames are additive billboards flickering in the shader; a small
 * pool of point lights (2 on the light tier, 6 elsewhere) follows the torches nearest the walker in walk mode.
 * The pool is always mounted and visible (intensity 0 outside walk): three counts every visible light into the
 * shader program key, so mounting/hiding lights on mode changes would recompile every lit material.
 */
const POLE_H = 2.1
const LIT_KINDS = new Set(['sacred', 'christian', 'leisure', 'defence', 'civic'])

/** Current torch positions (local metres), read by the place audio for night-time crackle. */
export const TORCH_SPOTS: { list: Array<[number, number, number]> } = { list: [] }

function torchSpots(t: Terrain, year: number, gated: boolean) {
  const out: Array<[number, number, number]> = []
  const f = gridFrame(t)
  const add = (x: number, z: number) => out.push([x, t.heightAt(x, z), z])
  for (let u = 18; u < f.L - 10; u += 36) for (const side of [-1, 1]) {
    const [x, z] = f.P(u + (side > 0 ? 18 : 0), side * 6.3)
    add(x, z)
  }
  for (const l of LANDMARKS) {
    if (!LIT_KINDS.has(l.category)) continue
    if (gated && (year < l.built || (l.until !== undefined && year > l.until))) continue
    const s = standPoint(l.id)
    if (!s) continue
    // a pair either side of the approach, a little in front of the stand point
    const fx = Math.sin(s.yaw + Math.PI), fz = Math.cos(s.yaw + Math.PI)
    const rx = fz, rz = -fx
    for (const side of [-1, 1]) add(s.x - fx * 3 + rx * 2.6 * side, s.z - fz * 3 + rz * 2.6 * side)
    // Interior oil-lamp / brazier glow inside covered civic & sacred halls for atmospheric dusk/night walkthroughs
    if (['latrine', 'baths', 'cathedral', 'martyrium', 'philip-church', 'apollo'].includes(l.id)) {
      const [lx, lz] = t.toLocal(l.lat, l.lon)
      const yaw = THREE.MathUtils.degToRad(l.rotation ?? 0)
      const back = Number(l.builderOpts?.back ?? 0)
      const cx = lx - Math.sin(yaw) * back, cz = lz - Math.cos(yaw) * back
      out.push([cx, t.heightAt(cx, cz) + (l.id === 'apollo' ? 2.5 : 0.6), cz])
    }
  }
  return out
}

function poleGeometry() {
  const legs: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const g = new THREE.CylinderGeometry(0.025, 0.035, POLE_H, 5)
    g.rotateZ(0.12); g.rotateY(a); g.translate(Math.cos(a) * 0.14, POLE_H / 2, Math.sin(a) * 0.14)
    legs.push(g)
  }
  const bowl = new THREE.CylinderGeometry(0.22, 0.12, 0.16, 10, 1, true).translate(0, POLE_H + 0.05, 0)
  const ring = new THREE.TorusGeometry(0.15, 0.02, 4, 10).rotateX(Math.PI / 2).translate(0, POLE_H * 0.55, 0)
  const all = [...legs, bowl, ring].map((g) => g.index ? g.toNonIndexed() : g)
  let n = 0
  for (const g of all) n += g.attributes.position.count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3)
  let o = 0
  for (const g of all) {
    pos.set(g.attributes.position.array as Float32Array, o * 3)
    nor.set(g.attributes.normal.array as Float32Array, o * 3)
    o += g.attributes.position.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return out
}

const flameMaterial = () => new THREE.ShaderMaterial({
  uniforms: { uTime: sceneUniforms.uTime, uTorch: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute float aSeed;
    varying vec2 vUv; varying float vSeed;
    uniform float uTime, uTorch;
    void main() {
      vUv = uv; vSeed = aSeed;
      vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      // cylindrical billboard: always upright, turned to the camera
      vec3 toCam = cameraPosition - c.xyz; toCam.y = 0.0;
      vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
      float flick = 0.85 + 0.15 * sin(uTime * 13.0 + aSeed * 31.0) * sin(uTime * 7.3 + aSeed * 11.0);
      vec2 sz = vec2(0.42, 0.85 * flick) * uTorch;
      vec3 p = c.xyz + right * position.x * sz.x + vec3(0.0, (position.y + 0.5) * sz.y, 0.0);
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv; varying float vSeed;
    uniform float uTime;
    void main() {
      vec2 q = vUv - vec2(0.5, 0.0);
      float sway = sin(uTime * 5.0 + vSeed * 9.0 + vUv.y * 4.0) * 0.06 * vUv.y;
      q.x += sway;
      float w = mix(0.42, 0.04, pow(vUv.y, 0.8));
      float body = smoothstep(w, w * 0.25, abs(q.x)) * smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
      float core = smoothstep(w * 0.55, 0.0, abs(q.x)) * smoothstep(0.65, 0.1, vUv.y);
      vec3 col = mix(vec3(1.0, 0.35, 0.06), vec3(1.0, 0.82, 0.45), core);
      gl_FragColor = vec4(col * (body * 1.6 + core), body);
      if (gl_FragColor.a < 0.01) discard;
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
})

const glowMaterial = () => new THREE.ShaderMaterial({
  uniforms: { uTorch: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv; uniform float uTorch;
    void main() {
      vUv = uv;
      vec4 c = viewMatrix * modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      c.xy += position.xy * 3.2 * uTorch;
      gl_Position = projectionMatrix * c;
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    void main() { float d = length(vUv - 0.5) * 2.0; float a = pow(max(1.0 - d, 0.0), 2.4) * 0.35; gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
})

export default function Torches({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const year = useApp((s) => s.year)
  const era = useApp((s) => s.era)
  const gated = timeGated(mode)
  // rebuild only when the year crosses a century (monuments appear/vanish on that scale)
  const bucket = gated ? Math.floor(year / 50) : 0
  const spots = useMemo(() => torchSpots(terrain, bucket * 50 + 25, gated), [terrain, bucket, gated])
  useEffect(() => { TORCH_SPOTS.list = spots; return () => { if (TORCH_SPOTS.list === spots) TORCH_SPOTS.list = [] } }, [spots])
  const pole = useMemo(poleGeometry, [])
  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a4630', metalness: 0.55, roughness: 0.5 }), [])
  const flame = useMemo(flameMaterial, [])
  const glow = useMemo(glowMaterial, [])
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const poles = useRef<THREE.InstancedMesh>(null)
  const flames = useRef<THREE.InstancedMesh>(null)
  const glows = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    const m = new THREE.Matrix4()
    const seeds = new Float32Array(spots.length)
    spots.forEach(([x, y, z], i) => {
      m.makeTranslation(x, y, z)
      poles.current?.setMatrixAt(i, m)
      m.makeTranslation(x, y + POLE_H + 0.1, z)
      flames.current?.setMatrixAt(i, m)
      glows.current?.setMatrixAt(i, m.makeTranslation(x, y + POLE_H + 0.45, z))
      seeds[i] = (i * 0.618) % 1
    })
    for (const r of [poles, flames, glows]) {
      const im = r.current
      if (!im) continue
      im.count = spots.length
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
    }
    flames.current?.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  }, [spots])

  useEffect(() => () => { pole.dispose(); poleMat.dispose(); flame.dispose(); glow.dispose(); quad.dispose() }, [pole, poleMat, flame, glow, quad])

  // point-light pool: re-pick the nearest lit torches every few frames
  const lightCount = isLight ? 2 : 6
  const lights = useRef<Array<THREE.PointLight | null>>([])
  const order = useMemo(() => new Int32Array(lightCount), [lightCount])
  const best = useMemo(() => new Float64Array(lightCount), [lightCount])
  const tick = useRef(0)
  useFrame(({ camera }) => {
    const k = SKY.torch * (1 - sceneUniforms.uPlan.value)
    flame.uniforms.uTorch.value = k
    glow.uniforms.uTorch.value = k
    const shown = era === 'ancient' && mode !== 'plan'
    if (group.current) group.current.visible = shown
    if (mode !== 'walk' || !shown) {
      for (let j = 0; j < lightCount; j++) { const l = lights.current[j]; if (l) l.intensity = 0 }
      return
    }
    if (++tick.current % 10 === 0) {
      const cx = camera.position.x, cz = camera.position.z
      best.fill(Infinity)
      order.fill(-1)
      for (let i = 0; i < spots.length; i++) {
        const dx = spots[i][0] - cx, dz = spots[i][2] - cz, d = dx * dx + dz * dz
        if (d > 60 * 60 || d >= best[lightCount - 1]) continue
        let j = lightCount - 1
        while (j > 0 && best[j - 1] > d) { best[j] = best[j - 1]; order[j] = order[j - 1]; j-- }
        best[j] = d; order[j] = i
      }
      for (let j = 0; j < lightCount; j++) {
        const l = lights.current[j], i = order[j]
        if (!l) continue
        if (i >= 0) l.position.set(spots[i][0], spots[i][1] + POLE_H + 0.5, spots[i][2])
        l.userData.on = i >= 0
      }
    }
    const t = performance.now() / 1000
    for (let j = 0; j < lightCount; j++) {
      const l = lights.current[j]
      if (!l) continue
      l.intensity = l.userData.on ? k * 14 * (0.88 + 0.12 * Math.sin(t * 11 + j * 1.7) * Math.sin(t * 6.1 + j)) : 0
    }
  })

  return (
    <>
      {spots.length > 0 && (
        <group ref={group}>
          <instancedMesh ref={poles} args={[pole, poleMat, spots.length]} castShadow={false} receiveShadow />
          <instancedMesh ref={flames} args={[quad, flame, spots.length]} frustumCulled={false} renderOrder={5} />
          <instancedMesh ref={glows} args={[quad, glow, spots.length]} frustumCulled={false} renderOrder={6} />
        </group>
      )}
      {/* outside the toggled group so the light count (and every shader program) stays constant */}
      {Array.from({ length: lightCount }, (_, j) => (
        <pointLight key={j} ref={(el) => { lights.current[j] = el }} color="#ff9a4a" intensity={0} distance={16} decay={1.6} />
      ))}
    </>
  )
}
