const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const THREE = require('three')
const code = ts.transpileModule(fs.readFileSync('src/scene/terrainData.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const context = { exports: {} }
vm.runInNewContext(code, context)
const { terrainCellHeight } = context.exports

test('height queries match actual rendered triangles across a non-planar cell', () => {
  const heights = [0, 2, 3, 12]
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2)
  const p = geometry.getAttribute('position')
  for (let i = 0; i < 4; i++) p.setY(i, heights[i])
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  mesh.updateMatrixWorld()
  const ray = new THREE.Raycaster()
  for (const [u, v] of [[0.1, 0.2], [0.5, 0.5], [0.8, 0.7], [0, 0], [1, 1]]) {
    ray.set(new THREE.Vector3(u - 0.5, 30, v - 0.5), new THREE.Vector3(0, -1, 0))
    const [hit] = ray.intersectObject(mesh)
    assert.ok(hit)
    assert.ok(Math.abs(terrainCellHeight(...heights, u, v) - hit.point.y) < 1e-6)
  }
  geometry.dispose(); mesh.material.dispose()
})
test('shared diagonal remains continuous', () => {
  for (const u of [0, 0.2, 0.5, 0.8, 1]) {
    const v = 1 - u
    assert.ok(Math.abs(terrainCellHeight(0, 2, 3, 12, u, v) - (2 * u + 3 * v)) < 1e-8)
  }
})
