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
