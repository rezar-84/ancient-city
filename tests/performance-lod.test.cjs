const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const runtimePromise = Promise.all([
  import('three'),
  import('three/examples/jsm/utils/BufferGeometryUtils.js'),
  import('three-mesh-bvh'),
]).then(([THREE, BGU, BVH]) => {
  const cache = new Map()
  function loadTs(relPath) {
    const abs = path.resolve(relPath)
    if (cache.has(abs)) return cache.get(abs)
    const exports = {}
    cache.set(abs, exports)
    const src = fs.readFileSync(abs, 'utf8')
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: abs,
    }).outputText
    const localRequire = (spec) => {
      if (spec === 'three') return THREE
      if (spec.includes('BufferGeometryUtils')) return BGU
      if (spec === 'three-mesh-bvh') return BVH
      if (spec.startsWith('.')) {
        const base = path.resolve(path.dirname(abs), spec)
        for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
          if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return loadTs(cand)
        }
      }
      return require(spec)
    }
    vm.runInNewContext(js, {
      exports, module: { exports }, require: localRequire, console, Math, Number, Object, Array, Map, Set, WeakMap,
      Float32Array, Float64Array, Uint16Array, Uint32Array, Uint8Array, Int32Array, ArrayBuffer,
    }, { filename: abs })
    return exports
  }
  return {
    THREE,
    physics: loadTs('src/walk/physics.ts'),
    colonnade: loadTs('src/scene/generators/colonnade.ts'),
    theatre: loadTs('src/scene/generators/theatre.ts'),
    water: loadTs('src/scene/water/index.ts'),
    npc: loadTs('src/walk/npcGeometry.ts'),
  }
})

test('WorldProbe spatially filters multi-hundred InstancedMesh grids and deduplicates shared epoch refreshes', async () => {
  const { THREE, physics } = await runtimePromise
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  root.name = 'city-root'
  scene.add(root)

  // Place 400 column/block instances across a 20x20 grid (10 m spacing)
  const count = 400
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 3.0, 1.2), new THREE.MeshBasicMaterial(), count)
  const m4 = new THREE.Matrix4()
  let idx = 0
  for (let gx = 0; gx < 20; gx++) {
    for (let gz = 0; gz < 20; gz++) {
      m4.makeTranslation(gx * 10, 1.5, gz * 10)
      im.setMatrixAt(idx++, m4)
    }
  }
  im.instanceMatrix.needsUpdate = true
  root.add(im)

  const probe = new physics.WorldProbe()
  assert.equal(probe.refreshIfNeeded(scene, 'epoch-1'), true)
  assert.equal(probe.refreshIfNeeded(scene, 'epoch-1'), false, 'second call with same epoch should skip rebuild')
  assert.equal(probe.refreshIfNeeded(scene, 'epoch-2'), true, 'changed epoch triggers rebuild')

  // Hit directly above instance (70, 1.5, 130) -> top at y = 3.0
  assert.ok(Math.abs(probe.ground(70, 130, 5) - 3.0) < 1e-4)
  // Miss in gap (75, 135)
  assert.equal(probe.ground(75, 135, 5), -Infinity)
  // Wall normal approaching instance (120, 1.5, 80) from -X
  const out = new THREE.Vector3()
  const normal = probe.wall(118.5, 1.2, 80, 1, 0, 1.5, out)
  assert.ok(normal && normal.x < -0.99)
})

test('decorative street paving and theatre dentils exclude redundant collision & shadow passes while preserving solid support', async () => {
  const { THREE, physics, colonnade, theatre } = await runtimePromise
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  root.name = 'city-root'
  const street = colonnade.createColonnadedStreet({ length: 60 })
  const th = theatre.createTheatre()
  th.position.set(200, 0, 0)
  root.add(street, th)
  scene.add(root)

  let noCollideInstances = 0
  root.traverse((o) => {
    if (o.isInstancedMesh) {
      assert.ok(o.boundingSphere && o.boundingSphere.radius > 0, 'all repeated InstancedMeshes compute boundingSphere')
      if (o.userData.noCollide) {
        assert.equal(o.userData.noShadow, true)
        noCollideInstances += o.count
      }
    }
  })
  assert.ok(noCollideInstances >= 300, `expected >= 300 decorative instances excluded from raycast, got ${noCollideInstances}`)

  const probe = new physics.WorldProbe()
  probe.refresh(scene)
  // Street carriageway remains solid at ~0.16 m
  const streetY = probe.ground(2.0, 0, 2.0)
  assert.ok(streetY >= 0.14 && streetY <= 0.22, `street carriageway support height=${streetY}`)
  // Theatre seating remains walkable
  const caveaY = probe.ground(200, -25, 25)
  assert.ok(caveaY > 2.0, `theatre cavea support height=${caveaY}`)
})

test('water masonry deduplicates cloned stone materials and crowd far LOD stays under 25% of near triangles', async () => {
  const { water, npc } = await runtimePromise
  const terrain = {
    heightAt: (x) => 100 + x * 0.1,
    toLocal: (lat, lon) => [(lon - 29.12558) * 88000, -(lat - 37.92615) * 111000],
  }
  const { group } = water.buildWater(terrain)
  const stoneMats = new Set()
  group.traverse((o) => {
    if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.isMeshPhysicalMaterial) stoneMats.add(o.material)
  })
  assert.equal(stoneMats.size, 2, `expected 2 shared cloned stone materials across water phases, got ${stoneMats.size}`)

  for (const era of ['greek', 'roman', 'byzantine']) {
    const nearG = npc.createPersonGeometry(era, 'near')
    const farG = npc.createPersonGeometry(era, 'far')
    const nearTris = nearG.attributes.position.count / 3
    const farTris = farG.attributes.position.count / 3
    assert.ok(farTris < nearTris * 0.25, `${era}: farTris=${farTris} should be <25% of nearTris=${nearTris}`)
    nearG.dispose()
    farG.dispose()
  }
})
