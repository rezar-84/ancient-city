import * as T from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { loadCitizenAssets, createRiggedCitizen } from '../../src/walk/riggedCitizen'

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
function resize() {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
resize()
window.addEventListener('resize', resize)
const input = (id: string) => document.querySelector<HTMLSelectElement>('#' + id)!
async function fit() {
  await loadCitizenAssets()
  const palette = { cloth: new T.Color('#b99467'), accent: new T.Color('#754830'), skin: new T.Color('#aa805f') }
  const figures = { m: createRiggedCitizen('roman', palette, 'm'), f: createRiggedCitizen('roman', palette, 'f') }
  scene.add(figures.m.root, figures.f.root)
  const clock = new T.Clock()
  document.querySelector('output')!.textContent = ''
  renderer.setAnimationLoop(() => {
    const female = input('figure').value === 'f'
    figures.f.root.visible = female
    figures.m.root.visible = !female
    const actor = female ? figures.f : figures.m
    actor.setCut(input('cut').value === 'full' ? 'full' : 'work')
    actor.update(clock.getDelta(), { speed: Number(input('speed').value), grounded: true, wave: false, look: 0, groundAt: () => 0 })
    renderer.render(scene, camera)
  })
}
fit().catch(() => { document.querySelector('output')!.textContent = 'Could not load the citizen models.' })
