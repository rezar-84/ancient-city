const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const THREE = require('three')
const api = import('three/examples/jsm/utils/BufferGeometryUtils.js').then(utils => {
  const cache = new Map()
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file)
    const exports = {}; cache.set(file, exports)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    vm.runInNewContext(code, { exports, require: id => id === 'three' ? THREE : id.includes('BufferGeometryUtils') ? utils : load(path.resolve(path.dirname(file), id + '.ts')) }, { filename: file })
    return exports
  }
  return load('src/scene/water/index.ts')
})
const terrain = slope => ({ heightAt: (x,z) => 100 + x * slope, toLocal: (lat,lon) => [(lon-29.12558)*88000, -(lat-37.92615)*111000] })
test('finite geometry, valid polygons, western descent and bounded system', async () => {
  const { buildWater, waterAt } = await api
  for (const slope of [0, 0.3]) {
    const { group, volumes } = buildWater(terrain(slope))
    assert.equal(volumes.length, 61)
    let triangles = 0, vertices = 0, calls = 0
    group.traverse(o => {
      if (!o.isMesh) return
      calls++
      const g = o.geometry, multiplier = o.isInstancedMesh ? o.count : 1
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3 * multiplier
      vertices += g.attributes.position.count * multiplier
      for (const a of Object.values(g.attributes)) assert.ok([...a.array].every(Number.isFinite))
      if (o.material.isMeshPhysicalMaterial) assert.ok(g.attributes.aDepth)
    })
    assert.ok(calls <= 25); assert.ok(triangles <= 120000)
    console.log({ slope, calls, triangles, vertices })
    for (const v of volumes) {
      assert.ok(v.polygon.length >= 3 && v.surfaceY > v.floorY)
      assert.equal(new Set(v.polygon.map(p => p.join(','))).size, v.polygon.length)
      let area = 0
      v.polygon.forEach(([x,z],i) => { const q=v.polygon[(i+1)%v.polygon.length]; area+=x*q[1]-q[0]*z })
      assert.ok(area > 0)
      const x = v.polygon.reduce((s,p)=>s+p[0],0)/v.polygon.length, z = v.polygon.reduce((s,p)=>s+p[1],0)/v.polygon.length
      const hit = waterAt(volumes,x,z); assert.ok(hit && hit.depth > 0)
      if (v.kind === 'terrace') assert.ok(hit.depth >= 0.19 && hit.depth <= 0.71)
    }
    assert.ok(volumes[55].polygon[0][0] < volumes[1].polygon[0][0])
    if (slope) assert.ok(volumes[55].surfaceY < volumes[1].surfaceY)
    assert.equal(waterAt(volumes,1e6,1e6),null)
    assert.ok(waterAt(volumes,0,0).depth >= 1.6)
    assert.ok(Math.abs(waterAt(volumes,15,0).depth - 0.4) < 0.02)
  }
})
test('synthetic polygon queries support concavity, boundary and highest overlap', async () => {
  const {waterAt} = await api
  const v = [{id:'test',kind:'basin',polygon:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]],surfaceY:3,floorY:1}]
  assert.equal(waterAt(v,0.5,3).depth,2)
  assert.equal(waterAt(v,3,3),null)
  assert.equal(waterAt(v,0,0).surface,3)
  assert.equal(waterAt([...v,{...v[0],surfaceY:5}],0.5,0.5).surface,5)
})
test('shader variants share a stable ripple ring and include normals, depth and sheet flow', async () => {
  const {createWaterMaterial,waterUniforms,addRipple,createFountainWater,createWaterSheet,createSteam}=await api
  const refs=waterUniforms.uRipples.value.slice()
  waterUniforms.uTime.value=12
  for(let i=0;i<19;i++)addRipple(i,-i,0.5)
  refs.forEach((v,i)=>assert.equal(v,waterUniforms.uRipples.value[i]))
  assert.equal(refs[2].x,18); assert.equal(refs[2].z,12)
  for(const kind of ['pool','terrace','basin','sheet']) {
    const mat=createWaterMaterial({kind,fizz:true})
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader}
    mat.onBeforeCompile(shader,{})
    assert.equal(shader.uniforms.uTime,waterUniforms.uTime)
    assert.ok(shader.fragmentShader.includes('for (int i = 0; i < 16; i++)'))
    assert.ok(shader.vertexShader.includes('attribute float aDepth'))
    assert.ok(shader.fragmentShader.includes('normal = normalize(normal + waterPerturb)'))
    assert.ok(shader.fragmentShader.includes('fizzCell'))
    if(kind==='sheet')assert.ok(shader.fragmentShader.includes('vWaterUv.y * 22.0 + uTime * 5.0'))
  }
  assert.ok(createFountainWater(2,3,1).geometry.attributes.aDepth)
  const sheet=createWaterSheet(2,3);sheet.geometry.computeBoundingBox();assert.equal(sheet.geometry.boundingBox.min.y,-3)
  const steam=createSteam([new THREE.Vector3()],10);assert.equal(steam.mesh.count,10);assert.equal(steam.mesh.material.uniforms.uSteam,steam.uSteam)
})
