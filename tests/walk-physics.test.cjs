const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const THREE = require('three')
const source = fs.readFileSync('src/walk/physics.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const context = { exports: {}, require }
vm.runInNewContext(js, context)
const { WorldProbe } = context.exports

function world() {
  const scene = new THREE.Scene()
  const street = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 10), new THREE.MeshBasicMaterial())
  street.name = 'walk-streets'; street.position.y = 0.2
  scene.add(street)
  const probe = new WorldProbe(); probe.refresh(scene)
  return { scene, street, probe }
}
test('raised street is a walkable support surface', () => {
  const { probe } = world()
  assert.ok(Math.abs(probe.ground(0, 0, 1) - 0.4) < 0.00001)
})
test('hidden streets do not obstruct another era', () => {
  const { street, probe } = world(); street.visible = false
  assert.equal(probe.ground(0, 0, 1), -Infinity)
})
test('camera boom stops before a wall', () => {
  const { scene, probe } = world()
  const root = new THREE.Group(); root.name = 'city-root'; scene.add(root)
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.4), new THREE.MeshBasicMaterial())
  wall.position.set(0, 2, 2); root.add(wall); probe.refresh(scene)
  const distance = probe.cameraDistance(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, 4))
  assert.ok(distance > 1.5 && distance < 1.7)
})
test('rotated instance collision normal is transformed into world space', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); root.name = 'city-root'; scene.add(root)
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 4, 0.2), new THREE.MeshBasicMaterial(), 1)
  mesh.setMatrixAt(0, new THREE.Matrix4().makeRotationY(Math.PI / 2)); root.add(mesh)
  const probe = new WorldProbe(); probe.refresh(scene)
  const normal = probe.wall(-2, 0, 0, 1, 0, 4, new THREE.Vector3())
  assert.ok(normal && normal.x < -0.99)
})
test('head clearance detects the underside of a low roof', () => {
  const { scene, probe } = world()
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 4), new THREE.MeshBasicMaterial())
  const root = new THREE.Group(); root.name = 'city-root'; root.add(roof); scene.add(root)
  roof.position.y = 2.2; probe.refresh(scene)
  assert.ok(Math.abs(probe.ceiling(0, 0, 1.9, 0.5) - 2.1) < 1e-6)
  assert.equal(probe.ceiling(0, 0, 1.9, 0.1), Infinity)
})
