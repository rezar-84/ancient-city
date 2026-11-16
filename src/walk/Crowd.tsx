import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Terrain } from '../scene/terrainData'
import { GRID } from '../content/grid'
import { useApp } from '../store'

const N_PEOPLE = 320, N_CARTS = 16
const CLOTH = ['#efe8dc', '#d8c6a8', '#8a5a3a', '#6b2f57', '#9c2f2f', '#5a6a7a', '#c9a45c', '#4a5a3a', '#b5653f', '#e6dccb']
const SKIN = ['#c69c7a', '#a87a58', '#d7b08f', '#8f6447']

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function personGeo() {
  const robe = new THREE.CylinderGeometry(0.17, 0.3, 1.3, 8).translate(0, 0.65, 0)
  const shoulders = new THREE.SphereGeometry(0.2, 8, 6).scale(1.1, 0.55, 0.8).translate(0, 1.3, 0)
  return mergeGeometries([robe.toNonIndexed(), shoulders.toNonIndexed()])!
}
function headGeo() { return new THREE.SphereGeometry(0.11, 10, 8).translate(0, 1.53, 0) }
function horseGeo() {
  const parts = [
    new THREE.BoxGeometry(0.5, 0.55, 1.5).translate(0, 1.15, 0), // body
    new THREE.BoxGeometry(0.28, 0.65, 0.3).rotateX(-0.6).translate(0, 1.55, 0.78), // neck
    new THREE.BoxGeometry(0.22, 0.25, 0.5).translate(0, 1.82, 1.05), // head
    ...[[-0.17, 0.6], [0.17, 0.6], [-0.17, -0.6], [0.17, -0.6]].map(([x, z]) => new THREE.BoxGeometry(0.11, 0.9, 0.11).translate(x, 0.45, z)),
  ]
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!
}
function cartGeo() {
  const parts = [
    new THREE.BoxGeometry(1.3, 0.45, 1.7).translate(0, 0.95, -1.9), // bed
    new THREE.CylinderGeometry(0.55, 0.55, 0.08, 14).rotateZ(Math.PI / 2).translate(-0.72, 0.55, -1.9),
    new THREE.CylinderGeometry(0.55, 0.55, 0.08, 14).rotateZ(Math.PI / 2).translate(0.72, 0.55, -1.9),
    new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0, 1.0, -0.4), // shaft
    new THREE.BoxGeometry(1.1, 0.5, 1.2).translate(0, 1.4, -1.95), // load (wool bales / amphorae)
  ]
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!
}

interface Walker { u: number; v: number; dir: number; speed: number; min: number; max: number; cross: boolean; phase: number }

/** Townspeople and carts moving along the plateia and side streets (walk mode, or the whole-city layer). */
export function Crowd({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const showGrid = useApp((s) => s.showGrid)
  const visible = era === 'ancient' && (mode === 'walk' || (mode === 'explore' && showGrid) || mode === 'tour')

  const setup = useMemo(() => {
    const [ax, az] = terrain.toLocal(...GRID.axisFrom), [bx, bz] = terrain.toLocal(...GRID.axisTo)
    const L = Math.hypot(bx - ax, bz - az)
    const u: [number, number] = [(bx - ax) / L, (bz - az) / L], v: [number, number] = [u[1], -u[0]]
    const rand = rng(85)
    const people: Walker[] = []
    for (let i = 0; i < N_PEOPLE; i++) {
      if (i < N_PEOPLE * 0.7) {
        // along the colonnaded main street, in the porticoes and the carriageway
        const lane = [-9.5, -5, -2, 2, 5, 9.5][Math.floor(rand() * 6)]
        // denser near the gate, the agora and the middle of the street
        const uu = rand() < 0.45 ? 15 + rand() * 260 : 20 + rand() * (L - 40)
        people.push({ u: uu, v: lane + (rand() - 0.5), dir: rand() < 0.5 ? 1 : -1, speed: 0.7 + rand() * 0.7, min: 15, max: L - 15, cross: false, phase: rand() * 10 })
      } else {
        // up and down a side street (stenopos)
        const k = 3 + Math.floor(rand() * (L / GRID.pitchU - 6))
        const side = rand() < 0.5 ? 1 : -1
        people.push({ u: k * GRID.pitchU + (rand() - 0.5) * 1.2, v: side * (14 + rand() * 180), dir: rand() < 0.5 ? 1 : -1, speed: 0.6 + rand() * 0.6, min: side > 0 ? 14 : -200, max: side > 0 ? 200 : -14, cross: true, phase: rand() * 10 })
      }
    }
    const carts: Walker[] = Array.from({ length: N_CARTS }, (_, i) => ({ u: 40 + rand() * (L - 80), v: i % 2 ? 2.2 : -2.2, dir: i % 2 ? 1 : -1, speed: 1.1 + rand() * 0.4, min: 30, max: L - 30, cross: false, phase: rand() * 10 }))
    const P = (pu: number, pv: number): [number, number] => [ax + u[0] * pu + v[0] * pv, az + u[1] * pu + v[1] * pv]
    const yawU = Math.atan2(u[0], u[1]), yawV = Math.atan2(v[0], v[1])

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92 })
    const body = new THREE.InstancedMesh(personGeo(), mat, N_PEOPLE)
    const head = new THREE.InstancedMesh(headGeo(), mat, N_PEOPLE)
    const horse = new THREE.InstancedMesh(horseGeo(), new THREE.MeshStandardMaterial({ roughness: 0.8 }), N_CARTS)
    const cart = new THREE.InstancedMesh(cartGeo(), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }), N_CARTS)
    const c = new THREE.Color()
    for (let i = 0; i < N_PEOPLE; i++) {
      body.setColorAt(i, c.set(CLOTH[Math.floor(rand() * CLOTH.length)]))
      head.setColorAt(i, c.set(SKIN[Math.floor(rand() * SKIN.length)]))
    }
    for (let i = 0; i < N_CARTS; i++) horse.setColorAt(i, c.set(['#6b4a32', '#3b2a1e', '#8a6a4a', '#d8c6a8'][i % 4]))
    for (const m of [body, head, horse, cart]) { m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) }
    return { people, carts, P, yawU, yawV, body, head, horse, cart }
  }, [terrain])

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const time = useRef(0)

  useFrame((_, rawDt) => {
    if (!visible) return
    const dt = Math.min(rawDt, 0.1); time.current += dt
    const { people, carts, P, yawU, yawV, body, head, horse, cart } = setup
    people.forEach((w, i) => {
      if (w.cross) { w.v += w.dir * w.speed * dt; if (w.v > w.max || w.v < w.min) w.dir *= -1 } else { w.u += w.dir * w.speed * dt; if (w.u > w.max || w.u < w.min) w.dir *= -1 }
      const [x, z] = P(w.u, w.v)
      const bobY = Math.abs(Math.sin(time.current * w.speed * 6 + w.phase)) * 0.04
      pos.set(x, terrain.heightAt(x, z) + bobY, z)
      q.setFromAxisAngle(up, (w.cross ? yawV : yawU) + (w.dir > 0 ? 0 : Math.PI))
      m4.compose(pos, q, one); body.setMatrixAt(i, m4); head.setMatrixAt(i, m4)
    })
    carts.forEach((w, i) => {
      w.u += w.dir * w.speed * dt; if (w.u > w.max || w.u < w.min) w.dir *= -1
      const [x, z] = P(w.u, w.v)
      pos.set(x, terrain.heightAt(x, z) + Math.abs(Math.sin(time.current * 5 + w.phase)) * 0.03, z)
      q.setFromAxisAngle(up, yawU + (w.dir > 0 ? 0 : Math.PI))
      m4.compose(pos, q, one); horse.setMatrixAt(i, m4); cart.setMatrixAt(i, m4)
    })
    for (const m of [body, head, horse, cart]) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group visible={visible}>
      <primitive object={setup.body} />
      <primitive object={setup.head} />
      <primitive object={setup.horse} />
      <primitive object={setup.cart} />
    </group>
  )
}
