import * as T from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  loadCitizenAssets, createRiggedCitizen,
  type AgeGroup, type CitizenRole, type Era, type FabricKind, type GarmentCut, type Gender,
} from '../../src/walk/riggedCitizen'

const renderer = new T.WebGLRenderer({ antialias: true })
document.body.append(renderer.domElement)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new T.Scene()
scene.background = new T.Color('#e2ddd2')
const camera = new T.PerspectiveCamera(32, 1, 0.05, 30)
camera.position.set(0, 1.15, -3.8)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.95, 0)
controls.update()
scene.add(new T.HemisphereLight('#ffffff', '#aa977c', 2))
const light = new T.DirectionalLight('#fff6e4', 2)
light.position.set(-3, 5, -3)
scene.add(light)

// 1.75 m datum ruler on ground + optional counter & step props for motion inspection
const grid = new T.GridHelper(3, 6, '#9c8f7a', '#cfc6b6')
scene.add(grid)
const counterProp = new T.Mesh(
  new T.BoxGeometry(1.15, 0.88, 0.48),
  new T.MeshStandardMaterial({ color: '#9c7853', roughness: 0.88 }),
)
counterProp.position.set(0, 0.44, 0.62)
counterProp.visible = false
scene.add(counterProp)
const stepProp = new T.Mesh(
  new T.BoxGeometry(1.1, 0.22, 0.72),
  new T.MeshStandardMaterial({ color: '#c8bea9', roughness: 0.92 }),
)
stepProp.position.set(0, 0.11, 0.44)
stepProp.visible = false
scene.add(stepProp)

function resize() {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
resize()
window.addEventListener('resize', resize)

const input = (id: string) => document.querySelector<HTMLSelectElement>('#' + id)!

document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.cam
    if (view === 'rear') camera.position.set(0, 1.12, -3.7)
    else if (view === 'side') camera.position.set(3.6, 1.10, 0)
    else camera.position.set(2.1, 1.18, 3.1)
    controls.target.set(0, 0.95, 0)
    controls.update()
  })
})

const ERA_SWATCH: Record<Era, { cloth: string; accent: string }> = {
  greek: { cloth: '#ddd2b8', accent: '#b88b36' },
  roman: { cloth: '#b99467', accent: '#754830' },
  byzantine: { cloth: '#636d7c', accent: '#b69850' },
}

const BODY_PRESETS: Record<string, { stature: number; build: number; age: AgeGroup }> = {
  adult: { stature: 1.0, build: 1.0, age: 'adult' },
  short: { stature: 0.925, build: 0.96, age: 'adult' },
  tall: { stature: 1.052, build: 1.02, age: 'adult' },
  older: { stature: 0.955, build: 1.10, age: 'older' },
  lean: { stature: 0.96, build: 0.87, age: 'young' },
  adolescent: { stature: 0.868, build: 0.84, age: 'adolescent' },
  child: { stature: 0.697, build: 0.76, age: 'child' },
}

const params = new URLSearchParams(location.search)
for (const id of ['era', 'figure', 'role', 'cut', 'fabric', 'body', 'speed']) {
  const v = params.get(id)
  if (v) {
    const el = input(id)
    if (Array.from(el.options).some((o) => o.value === v)) el.value = v
  }
}
const initialCam = params.get('cam')
if (initialCam === 'rear') camera.position.set(0, 1.12, -3.7)
else if (initialCam === 'side') camera.position.set(3.6, 1.10, 0)
else if (initialCam === 'front') camera.position.set(2.1, 1.18, 3.1)
controls.update()

async function fit() {
  await loadCitizenAssets()
  const eras: Era[] = ['greek', 'roman', 'byzantine']
  const genders: Gender[] = ['m', 'f']
  const actors = new Map<string, ReturnType<typeof createRiggedCitizen>>()
  for (const era of eras) {
    for (const g of genders) {
      const sw = ERA_SWATCH[era]
      const actor = createRiggedCitizen(era, {
        cloth: new T.Color(sw.cloth),
        accent: new T.Color(sw.accent),
        skin: new T.Color('#aa805f'),
      }, g)
      actor.root.visible = false
      scene.add(actor.root)
      actors.set(`${era}:${g}`, actor)
    }
  }
  const clock = new T.Clock()
  let elapsed = 0
  document.querySelector('output')!.textContent = ''
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta()
    elapsed += dt
    const era = input('era').value as Era
    const gender = input('figure').value as Gender
    const role = input('role').value as CitizenRole
    const cut = (input('cut').value === 'full' ? 'full' : 'work') as GarmentCut
    const fabric = (input('fabric').value === 'wool' ? 'wool' : 'linen') as FabricKind
    const preset = BODY_PRESETS[input('body').value] ?? BODY_PRESETS.adult
    const motionVal = input('speed').value
    const bending = motionVal === 'bend'
    const reaching = motionVal === 'reach'
    const stepping = motionVal === 'step'
    const landing = motionVal === 'land'
    const landCycle = elapsed % 1.8
    const grounded = !landing || landCycle >= 0.45
    const speed = bending || reaching || landing ? 0 : stepping ? 1.25 : Number(motionVal)

    counterProp.visible = reaching
    stepProp.visible = stepping

    actors.forEach((a, key) => { a.root.visible = key === `${era}:${gender}` })
    const actor = actors.get(`${era}:${gender}`)!
    actor.configure({ role, cut, fabric, age: preset.age })
    actor.root.scale.set(preset.build, preset.stature, preset.build)
    actor.root.position.y = landing && !grounded ? Math.sin((landCycle / 0.45) * Math.PI) * 0.34 : 0
    actor.update(dt, {
      speed,
      grounded,
      wave: false,
      look: 0,
      bend: bending ? 0.58 : reaching ? 0.22 : 0,
      reach: reaching ? 0.88 : 0,
      groundAt: stepping ? (_x, z) => (z > 0.08 ? 0.22 : 0) : () => 0,
    })
    renderer.render(scene, camera)
  })
}
fit().catch(() => { document.querySelector('output')!.textContent = 'Could not load the citizen models.' })
