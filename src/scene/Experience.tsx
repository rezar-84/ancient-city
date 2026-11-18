import { Suspense, lazy, use, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, PerformanceMonitor, Stats } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { getTerrain, loadTerrain } from './terrainData'
import { GradeAnimator, Terrain } from './Terrain'
import { flyTo, orbitPose, rig } from './camera'
import { City } from './City'
import { CityGrid } from './CityGrid'
import { CityDetails } from './CityDetails'
import { Pins } from './Pins'
import { TodayTiles } from './TodayTiles'
import { computeSky, SKY } from './sky'
import { isLight } from './quality'
import Torches from './Torches'
import Water from './Water'
import { PloutonionMist, SkyDome, patchFogChunks } from './Effects'
import { sceneUniforms } from './Terrain'
import { PlanInk } from './PlanInk'
import { Navigation } from './Navigation'
import { WalkControls, walk } from '../walk/WalkControls'
import { Crowd } from '../walk/Crowd'
import { capturePipeline, installCapture } from './captureRenders'
import { useApp } from '../store'
import { useState } from 'react'

const terrainPromise = loadTerrain()
patchFogChunks()
const PostFX = lazy(() => import('./PostFX'))

const SHADOW_RES = isLight ? 1536 : 3072
/** ?fx=0 / ?fx=1 forces the post-processing tier off/on (testing). */
const fxParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fx') : null


function World() {
  const data = use(terrainPromise)
  const era = useApp((s) => s.era)
  const walking = useApp((s) => s.mode === 'walk')
  return (
    <>
      <Terrain data={data} />
      <City terrain={data} />
      <CityGrid terrain={data} />
      <CityDetails terrain={data} />
      <Crowd terrain={data} />
      <Torches terrain={data} />
      <Water terrain={data} />
      {!walking && <Pins terrain={data} />}
      <PloutonionMist terrain={data} />
      <PlanInk terrain={data} />
      {era === 'today' && <TodayTiles terrain={data} />}
    </>
  )
}

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const live = useRef({ hour: -1, sent: 0 })
  const { scene } = useThree()
  const fog = useRef<THREE.Fog>(null)
  useEffect(() => {
    const l = light.current
    if (!l) return
    scene.add(l.target)
    // linear range drives the custom height fog (Effects.patchFogChunks): aerial perspective from ~500 m
    fog.current = new THREE.Fog(SKY.haze.clone(), 500, 9000)
    scene.fog = fog.current
    return () => { scene.remove(l.target); scene.fog = null }
  }, [scene])
  // shadow frustum follows the orbit target and tightens as the camera comes closer -> crisp close-up shadows
  const tgt = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const l = light.current, ctl = rig.controls, cam = rig.camera
    // time of day: the user's hour, or a slow cycle (1 game hour = 2 real minutes); the plan keeps its fixed light
    const app = useApp.getState()
    const lv = live.current
    let h = app.hour
    if (app.dayCycle && !app.walkPaused) {
      if (lv.hour < 0) lv.hour = app.hour
      lv.hour = (lv.hour + Math.min(dt, 0.1) / 120) % 24
      h = lv.hour
      if (Math.abs(h - app.hour) > 0.05 && performance.now() - lv.sent > 400) { lv.sent = performance.now(); app.setHour(h, true) }
    } else lv.hour = -1
    if (app.mode === 'plan') h = 16
    if (Math.abs(h - SKY.hour) > 1e-4) computeSky(h)
    if (hemi.current) { hemi.current.color.copy(SKY.hemiSky); hemi.current.groundColor.copy(SKY.hemiGround); hemi.current.intensity = SKY.hemiIntensity }
    if (l) { l.color.copy(SKY.lightColor); l.intensity = SKY.lightIntensity }
    scene.environmentIntensity = SKY.envIntensity
    // no haze on the parchment plan
    if (fog.current) { const p = sceneUniforms.uPlan.value; fog.current.color.copy(SKY.haze); fog.current.near = 500 + p * 1e6; fog.current.far = 9000 + p * 2e6 }
    if (!l || !ctl || !cam) return
    const walking = useApp.getState().mode === 'walk'
    if (walking) tgt.current.set(walk.x, walk.feet, walk.z)
    else tgt.current.copy(ctl.target)
    const d = walking ? 75 : cam.position.distanceTo(ctl.target)
    const ext = THREE.MathUtils.clamp(d * 0.55, walking ? 45 : 60, 1000)
    const sc = l.shadow.camera
    const wantNear = Math.max(120, 1600 - ext * 2.5 - 140)
    const wantFar = Math.min(3400, 1600 + ext * 2.5 + 180)
    if (Math.abs(sc.right - ext) > ext * 0.08 || Math.abs(sc.near - wantNear) > 40) {
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext
      sc.near = wantNear; sc.far = wantFar
      sc.updateProjectionMatrix()
    }
    // snap to shadow texels to avoid shimmering while orbiting
    const texel = (2 * ext) / SHADOW_RES
    const tx = Math.round(tgt.current.x / texel) * texel, tz = Math.round(tgt.current.z / texel) * texel
    l.target.position.set(tx, tgt.current.y, tz)
    l.position.set(tx + SKY.lightDir.x * 1600, tgt.current.y + SKY.lightDir.y * 1600, tz + SKY.lightDir.z * 1600)
    // bias in world units scales with texel size: no acne on the travertine, no peter-panning under houses
    l.shadow.normalBias = THREE.MathUtils.clamp(texel * 1.6, 0.06, 1.0)
  })
  return (
    <>
      {/* sky/ground bounce kept low so the sun's shadows read; the environment adds soft directional fill */}
      <hemisphereLight ref={hemi} args={['#c4d8ec', '#7a5c3e', 0.32]} />
      <directionalLight
        ref={light}
        intensity={2.6}
        color="#ffe2bd"
        castShadow
        shadow-mapSize={[SHADOW_RES, SHADOW_RES]}
        shadow-bias={-0.0002}
        shadow-camera-near={200}
        shadow-camera-far={3400}
      />
      {/* soft image-based light without any download: warm low sun-side, cool sky dome, warm ground bounce */}
      <Environment resolution={128} frames={1} environmentIntensity={0.55}>
        <color attach="background" args={['#8fa6ba']} />
        <Lightformer form="rect" intensity={2.6} color="#ffcf9c" position={[-7, 3, 4]} scale={[9, 2.5, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#bcd6f0" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[16, 16, 1]} />
        <Lightformer form="rect" intensity={0.45} color="#e9c9a0" position={[6, 1.5, -4]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={0.55} color="#9c7b58" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[16, 16, 1]} />
      </Environment>
      <SkyDome />
    </>
  )
}

/** Gentle auto-orbit on the title screen. */
function IntroOrbit() {
  const mode = useApp((s) => s.mode)
  useFrame((_, dt) => {
    if (capturePipeline.busy || mode !== 'intro' || !rig.controls) return
    rig.controls.autoRotate = true
    rig.controls.autoRotateSpeed = 0.35
    void dt
  })
  useEffect(() => { if (mode !== 'intro' && rig.controls) rig.controls.autoRotate = false }, [mode])
  return null
}

/** Camera moves when switching modes. */
function ModeCamera() {
  const mode = useApp((s) => s.mode)
  const prev = useRef(mode)
  useEffect(() => {
    const from = prev.current
    prev.current = mode
    const t = getTerrain()
    if (!t || useApp.getState().selected) return
    const [cx, cz] = t.toLocal(37.9282, 29.1258)
    const cy = t.heightAt(cx, cz)
    if (mode === 'plan') void flyTo([cx, cy + 1900, cz + 1], [cx, cy, cz], 2.2)
    else if (mode === 'explore' && (from === 'intro' || from === 'plan' || from === 'tour' || from === 'walk' || from === 'choose'))
      void flyTo(orbitPose([cx, cy, cz], 235, 32, 1350), [cx, cy, cz], 2.6)
  }, [mode])
  return null
}

function Controls() {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const mode = useApp((s) => s.mode)
  useEffect(() => { rig.camera = camera; rig.controls = ref.current }, [camera])
  const plan = mode === 'plan'
  // plan: drag pans the map, right-drag rotates (and tilts a little); 3D: drag orbits, right-drag pans
  const mouseButtons = plan
    ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  const touches = plan
    ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }
    : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      target={[150, 60, -150]}
      minDistance={25}
      maxDistance={3200}
      maxPolarAngle={plan ? 0.55 : 1.38}
      minPolarAngle={0}
      enableRotate
      rotateSpeed={plan ? 0.6 : 0.8}
      screenSpacePanning={plan}
      zoomToCursor
      zoomSpeed={0.9}
      mouseButtons={mouseButtons}
      touches={touches}
    />
  )
}

/** One resolution owner combines measured capacity with camera motion. */
function MotionQuality({ onMotion }: { onMotion: (moving: boolean) => void }) {
  const previous = useRef(new THREE.Vector3())
  const rotation = useRef(new THREE.Quaternion())
  const lastMove = useRef(0)
  const active = useRef(false)
  useFrame(({ camera, clock }) => {
    if (capturePipeline.busy) return
    const now = clock.elapsedTime
    if (previous.current.distanceToSquared(camera.position) > 0.0001 ||
        1 - Math.abs(rotation.current.dot(camera.quaternion)) > 0.000001) lastMove.current = now
    previous.current.copy(camera.position); rotation.current.copy(camera.quaternion)
    const moving = now - lastMove.current < 0.8
    if (active.current !== moving) { active.current = moving; onMotion(moving) }
  })
  return null
}

export function Experience() {
  const showPerf = useApp((s) => s.showPerf)
  const mode = useApp((s) => s.mode)
  const maxDpr = Math.min(window.devicePixelRatio, 1.75)
  const [dpr, setDpr] = useState(maxDpr)
  const [moving, setMoving] = useState(false)
  // Fixed resolution is useful for honest before/after profiling.
  const fixedValue = Number(new URLSearchParams(window.location.search).get('dpr'))
  const fixedDpr = fixedValue > 0 ? THREE.MathUtils.clamp(fixedValue, 0.65, maxDpr) : null
  // quality tier: AO/SMAA post chain on desktop GPUs; the first sustained decline turns it off for the session
  const [fx, setFx] = useState(fxParam ? fxParam === '1' : !isLight)
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __fx: (on: boolean) => void }).__fx = setFx
  }, [])
  return (
    <Canvas
      shadows
      dpr={fixedDpr ?? Math.max(0.65, dpr * (moving ? 0.8 : 1))}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      camera={{ position: [-1600, 1100, 1500], fov: 42, near: 2, far: 30000 }}
      onCreated={({ gl, scene }) => { if (import.meta.env.DEV) { (window as unknown as { __gl: unknown; __scene: unknown }).__gl = gl; (window as unknown as { __scene: unknown }).__scene = scene; installCapture(gl, scene) } }}
      onPointerMissed={() => useApp.getState().mode !== 'tour' && useApp.getState().select(null)}
    >
      <PerformanceMonitor
        flipflops={6}
        bounds={() => isLight ? [26, 35] : [45, 58]}
        onDecline={() => { if (capturePipeline.busy) return; if (fx && fxParam !== '1') setFx(false); else setDpr((d) => Math.max(0.65, d - 0.15)) }}
        onIncline={() => { if (!capturePipeline.busy) setDpr((d) => Math.min(maxDpr, d + 0.1)) }}
        onFallback={() => { if (capturePipeline.busy) return; if (fxParam !== '1') setFx(false); setDpr(0.65) }}
      />
      <MotionQuality onMotion={setMoving} />
      <Lights />
      <Suspense fallback={null}>
        <World />
      </Suspense>
      {fx && mode !== 'plan' && <Suspense fallback={null}><PostFX /></Suspense>}
      <GradeAnimator />
      <Controls />
      <IntroOrbit />
      <Navigation />
      <WalkControls />
      <ModeCamera />
      {showPerf && <Stats />}
    </Canvas>
  )
}
