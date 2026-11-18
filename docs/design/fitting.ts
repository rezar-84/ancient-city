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

// 1.75 m datum ruler on ground
const grid = new T.GridHelper(3, 6, '#9c8f7a', '#cfc6b6')
scene.add(grid)

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
}

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
  document.querySelector('output')!.textContent = ''
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta()
    const era = input('era').value as Era
    const gender = input('figure').value as Gender
    const role = input('role').value as CitizenRole
    const cut = (input('cut').value === 'full' ? 'full' : 'work') as GarmentCut
    const fabric = (input('fabric').value === 'wool' ? 'wool' : 'linen') as FabricKind
    const preset = BODY_PRESETS[input('body').value] ?? BODY_PRESETS.adult
    const motionVal = input('speed').value
    const bending = motionVal === 'bend'
    const speed = bending ? 0 : Number(motionVal)

    actors.forEach((a, key) => { a.root.visible = key === `${era}:${gender}` })
    const actor = actors.get(`${era}:${gender}`)!
    actor.configure({ role, cut, fabric, age: preset.age })
    actor.root.scale.set(preset.build, preset.stature, preset.build)
    actor.update(dt, {
      speed,
      grounded: true,
      wave: false,
      look: 0,
      bend: bending ? 0.58 : 0,
      groundAt: () => 0,
    })
    renderer.render(scene, camera)
  })
}
fit().catch(() => { document.querySelector('output')!.textContent = 'Could not load the citizen models.' })
