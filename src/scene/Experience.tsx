import { Suspense, use, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, Environment, Lightformer, OrbitControls, PerformanceMonitor, Stats } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { getTerrain, loadTerrain } from './terrainData'
import { GradeAnimator, Terrain } from './Terrain'
import { flyTo, orbitPose, rig } from './camera'
import { City } from './City'
import { CityGrid } from './CityGrid'
import { Pins } from './Pins'
import { TodayTiles } from './TodayTiles'
import { PloutonionMist } from './Effects'
import { PlanInk } from './PlanInk'
import { Navigation } from './Navigation'
import { installCapture } from './captureRenders'
import { useApp } from '../store'
import { useState } from 'react'

const terrainPromise = loadTerrain()

/** Golden-hour sun from the west-south-west: Pamukkale's travertines face west. */
const SUN_DIR = new THREE.Vector3(-0.78, 0.42, 0.46).normalize()

function World() {
  const data = use(terrainPromise)
  const era = useApp((s) => s.era)
  return (
    <>
      <Terrain data={data} />
      <City terrain={data} />
      <CityGrid terrain={data} />
      <Pins terrain={data} />
      <PloutonionMist terrain={data} />
      <PlanInk terrain={data} />
      {era === 'today' && <TodayTiles terrain={data} />}
    </>
  )
}

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()
  useEffect(() => {
    const l = light.current
    if (!l) return
    scene.add(l.target)
    scene.fog = new THREE.Fog('#b9a68c', 2600, 8000)
    return () => { scene.fog = null }
  }, [scene])
  // shadow frustum follows the orbit target and tightens as the camera comes closer -> crisp close-up shadows
  const tgt = useRef(new THREE.Vector3())
  useFrame(() => {
    const l = light.current, ctl = rig.controls, cam = rig.camera
    if (!l || !ctl || !cam) return
    tgt.current.copy(ctl.target)
    const d = cam.position.distanceTo(ctl.target)
    const ext = THREE.MathUtils.clamp(d * 0.75, 90, 1100)
    const sc = l.shadow.camera
    if (Math.abs(sc.right - ext) > ext * 0.08) {
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix()
    }
    // snap to shadow texels to avoid shimmering while orbiting
    const texel = (2 * ext) / 2048
    const tx = Math.round(tgt.current.x / texel) * texel, tz = Math.round(tgt.current.z / texel) * texel
    l.target.position.set(tx, tgt.current.y, tz)
    l.position.set(tx + SUN_DIR.x * 1600, tgt.current.y + SUN_DIR.y * 1600, tz + SUN_DIR.z * 1600)
    l.shadow.normalBias = THREE.MathUtils.clamp(ext / 600, 0.15, 1.2)
  })
  return (
    <>
      <hemisphereLight args={['#d6e6f2', '#8a6b4a', 0.55]} />
      <directionalLight
        ref={light}
        intensity={2.9}
        color="#ffd6a0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-camera-near={200}
        shadow-camera-far={3400}
      />
      {/* soft image-based light without any download: warm sun-side + cool sky light-formers */}
      <Environment resolution={128} frames={1}>
        <color attach="background" args={['#9fb4c4']} />
        <Lightformer form="rect" intensity={2.2} color="#ffd9b0" position={[-6, 3, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#cfe3f5" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#a88b6a" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[14, 14, 1]} />
      </Environment>
    </>
  )
}

/** Gentle auto-orbit on the title screen. */
function IntroOrbit() {
  const mode = useApp((s) => s.mode)
  useFrame((_, dt) => {
    if (mode !== 'intro' || !rig.controls) return
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
    else if (mode === 'explore' && (from === 'intro' || from === 'plan' || from === 'tour'))
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

export function Experience() {
  const showPerf = useApp((s) => s.showPerf)
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio, 1.75))
  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, toneMappingExposure: 1.05 }}
      camera={{ position: [-1600, 1100, 1500], fov: 42, near: 2, far: 30000 }}
      onCreated={({ gl, scene }) => { if (import.meta.env.DEV) { (window as unknown as { __gl: unknown }).__gl = gl; installCapture(gl, scene) } }}
      onPointerMissed={() => useApp.getState().mode !== 'tour' && useApp.getState().select(null)}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(Math.min(window.devicePixelRatio, 1.75), d + 0.25))}
      />
      <AdaptiveDpr pixelated={false} />
      <Lights />
      <Suspense fallback={null}>
        <World />
      </Suspense>
      <GradeAnimator />
      <Controls />
      <IntroOrbit />
      <Navigation />
      <ModeCamera />
      {showPerf && <Stats />}
    </Canvas>
  )
}
