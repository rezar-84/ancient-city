const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const THREE = require('three')
const api = import('three/examples/jsm/utils/BufferGeometryUtils.js').then(utils => {
  const code = ts.transpileModule(fs.readFileSync('src/walk/npcGeometry.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, require: id => id === 'three' ? THREE : utils }
  vm.runInNewContext(code, context)
  return context.exports
})
test('each era has valid geometry, a ground-level origin, and a bounded detail budget', async () => {
  const { createPersonGeometry } = await api
  for (const era of ['greek', 'roman', 'byzantine']) {
    const g = createPersonGeometry(era)
    assert.ok(g.boundingBox.min.y >= -0.001)
    assert.ok(g.boundingBox.max.y > 1.65 && g.boundingBox.max.y < 1.8)
    assert.ok(g.attributes.position.count / 3 < 3000)
    for (const attr of Object.values(g.attributes)) {
      assert.equal(attr.count, g.attributes.position.count)
      assert.ok([...attr.array].every(Number.isFinite))
    }
    g.dispose()
  }
})
test('depth animation declares joint transforms outside the displacement-map guard', async () => {
  const { patchCrowdMaterial } = await api
  const mat = new THREE.MeshDepthMaterial()
  patchCrowdMaterial(mat, 'person')
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.depth.vertexShader, fragmentShader: THREE.ShaderLib.depth.fragmentShader }
  mat.onBeforeCompile(shader, {})
  const displacementEnd = shader.vertexShader.indexOf('#endif', shader.vertexShader.indexOf('#ifdef USE_DISPLACEMENTMAP'))
  const joint = shader.vertexShader.indexOf('mat3 npcJoint')
  assert.ok(joint > displacementEnd)
  assert.ok(shader.vertexShader.includes('transformed = npcJoint *'))
  assert.ok(shader.uniforms.uTime)
  mat.dispose()
})

test('near/far budgets, smooth normals and common rig layout', async () => {
  const { createPersonGeometry } = await api
  for (const era of ['greek', 'roman', 'byzantine']) for (const lod of ['near', 'far']) {
    const g = createPersonGeometry(era, lod)
    const triangles = (g.index?.count ?? g.attributes.position.count) / 3
    console.log(`${era} ${lod}: ${triangles} triangles, ${g.attributes.position.count} vertices`)
    assert.ok(triangles <= (lod === 'near' ? 1800 : 400))
    assert.deepEqual(Object.keys(g.attributes).sort(), ['aPivot', 'aRig', 'color', 'normal', 'position'])
    for (const attr of Object.values(g.attributes)) assert.ok([...attr.array].every(Number.isFinite))
    const normal = g.attributes.normal
    for (let i = 0; i < normal.count; i++) assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 0.001)
    assert.ok(g.boundingBox.min.y >= -1e-6)
    g.dispose()
  }
})

test('all poses emitted in both shaders, optional defaults and attribute budget', async () => {
  const { POSE, patchCrowdMaterial, createCrowdAttributes } = await api
  assert.equal(new Set(Object.values(POSE)).size, 11)
  const attrs = createCrowdAttributes(2)
  assert.equal(attrs.pose.getY(0), 1)
  assert.equal(attrs.style.itemSize, 4)
  for (const kind of ['person', 'horse', 'cart']) {
    const sources = []
    for (const depth of [false, true]) {
      const mat = depth ? new THREE.MeshDepthMaterial() : new THREE.MeshStandardMaterial()
      patchCrowdMaterial(mat, kind)
      assert.deepEqual(Array.from(mat.defaultAttributeValues.iPose), [0, 1])
      const lib = depth ? THREE.ShaderLib.depth : THREE.ShaderLib.standard
      const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader }
      mat.onBeforeCompile(shader, {})
      for (const [name, value] of Object.entries(POSE)) assert.ok(shader.vertexShader.includes(`#define POSE_${name} ${value.toFixed(1)}`))
      assert.ok(!shader.vertexShader.includes('undefined'))
      const start = shader.vertexShader.indexOf('vec3 npcAngles =')
      const end = shader.vertexShader.indexOf('#include <morphtarget_vertex>')
      sources.push(shader.vertexShader.slice(start, end).replace('#include <begin_vertex>', ''))
      // Geometry 5 + instanceMatrix 4 + iAnim/tints 4 + style/pose 2.
      assert.ok(5 + 4 + Object.keys(attrs).length <= 16)
      mat.dispose()
    }
    // Normal and position logic are identical despite the depth chunk relocation.
    for (const text of ['npcRotation * npcJoint * objectNormal', 'transformed = npcJoint *', 'transformed = npcBody *']) {
      assert.ok(sources.every(s => s.includes(text)))
    }
  }
})

test('props and horse have finite compatible rig data', async () => {
  const { createHeldPropGeometry, createHorseGeometry, createCartGeometry } = await api
  for (const kind of ['amphora', 'basket', 'staff', 'scroll', 'horse', 'cart']) {
    const g = kind === 'horse' ? createHorseGeometry() : kind === 'cart' ? createCartGeometry() : createHeldPropGeometry(kind)
    console.log(`${kind}: ${g.attributes.position.count / 3} triangles, ${g.attributes.position.count} vertices`)
    for (const attr of Object.values(g.attributes)) assert.ok([...attr.array].every(Number.isFinite))
    assert.ok(g.boundingBox.min.y >= -0.001)
    assert.equal(g.attributes.aRig.itemSize, 4)
    if (kind === 'basket') assert.ok([...g.attributes.aRig.array].filter((_,i) => i % 4 === 1).every(x => x === 5))
    g.dispose()
  }
})
