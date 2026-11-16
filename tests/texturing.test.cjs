const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const THREE = require('three')
const jpeg = require('jpeg-js')
function load(three = THREE) {
  const code = ts.transpileModule(fs.readFileSync('src/scene/texturing.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = { exports: {}, require: id => { assert.equal(id, 'three'); return three } }
  vm.runInNewContext(code, context)
  return context.exports
}
const api = load()
test('GLSL has balanced delimiters, declared entry points, bounded fetch sites and early outs', () => {
  const glsl = api.TRIPLANAR_GLSL.replace(/\/\/[^\n]*/g, '')
  const stack = [], pairs = { '}': '{', ')': '(' }
  for (const c of glsl) {
    if ('{('.includes(c)) stack.push(c)
    if ('})'.includes(c)) assert.equal(stack.pop(), pairs[c])
  }
  assert.equal(stack.length, 0)
  for (const fn of ['triAlbedo', 'triNormal', 'triRoughness', 'triNormalRoughness', 'triFade']) {
    assert.match(glsl, new RegExp(`(?:vec[34]|float) ${fn}\\(`))
  }
  assert.equal((glsl.match(/texture2D\(tex,/g) || []).length, 3)
  assert.equal((glsl.match(/texture2D\(nr,/g) || []).length, 3)
  assert.match(glsl, /if \(triDetailWeight <= 0\.0\) return vec3\(1\.0\)/)
  assert.match(glsl, /if \(triDetailWeight <= 0\.0\) return vec4\(n, 1\.0\)/)
  assert.match(glsl, /if \(uTriBiplanar\)/)
})
test('injection preserves existing uniforms and varyings; caps fade and is idempotent', () => {
  const shader = { uniforms: { uWalk: { value: 1 } }, fragmentShader: THREE.ShaderLib.standard.fragmentShader + '\nvarying vec3 vW;\nvarying vec3 vWN;' }
  const opts = { albedo: new THREE.Texture(), nr: new THREE.Texture(), scale: 0.25, near: 30, far: 180, strength: 0.7, biplanar: true }
  api.applyTriplanar(shader, opts)
  assert.equal(shader.uniforms.uTriAlbedo.value, opts.albedo)
  assert.equal(shader.uniforms.uTriNR.value, opts.nr)
  assert.equal(shader.uniforms.uTriFar.value, 120)
  assert.equal(shader.uniforms.uTriBiplanar.value, true)
  assert.equal(shader.uniforms.uWalk.value, 1)
  assert.equal(shader.uniforms.uTriSharpness.value, 4)
  const source = shader.fragmentShader
  api.applyTriplanar(shader, { ...opts, strength: 0 })
  assert.equal(shader.fragmentShader, source)
  assert.equal(shader.uniforms.uTriStrength.value, 0)
  assert.equal((source.match(/varying vec3 vW;/g) || []).length, 1)
  for (const bad of [{ near: 120 }, { scale: 0 }, { far: NaN }, { strength: 2 }, { sharpness: 0 }]) {
    assert.throws(() => api.applyTriplanar(shader, { ...opts, ...bad }), /Invalid triplanar/)
  }
  assert.throws(() => api.applyTriplanar({ uniforms: {}, fragmentShader: '' }, opts), /common fragment/)
})
test('all 16 JPEGs decode at 512 square and stay below 2.5 MB', () => {
  let total = 0
  for (const name of api.RUNTIME_MATERIALS) for (const kind of ['albedo', 'nr']) {
    const bytes = fs.readFileSync(`public/tex/${name}_${kind}.jpg`)
    total += bytes.length
    const decoded = jpeg.decode(bytes)
    assert.equal(decoded.width, 512)
    assert.equal(decoded.height, 512)
    if (kind === 'nr') {
      let rough = 0
      for (let p = 0; p < 512 * 512; p++) rough += decoded.data[p * 4 + 2]
      assert.ok(rough / (512 * 512) > 120, `${name} roughness channel`)
    }
  }
  assert.ok(total <= 2_500_000, `${total} bytes`)
})
test('loader sets PBR color spaces, wrapping, filtering and mipmaps', async () => {
  const urls = []
  class Loader { async loadAsync(url) { urls.push(url); return new THREE.Texture() } }
  const maps = await load({ ...THREE, TextureLoader: Loader }).loadRuntimeTextures()
  assert.equal(urls.length, 16)
  for (const name of api.RUNTIME_MATERIALS) for (const kind of ['albedo', 'nr']) {
    const tex = maps[name][kind]
    assert.ok(urls.includes(`/tex/${name}_${kind}.jpg`))
    assert.equal(tex.wrapS, THREE.RepeatWrapping)
    assert.equal(tex.wrapT, THREE.RepeatWrapping)
    assert.equal(tex.generateMipmaps, true)
    assert.equal(tex.minFilter, THREE.LinearMipmapLinearFilter)
    assert.equal(tex.anisotropy, 4)
    assert.equal(tex.colorSpace, kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace)
    tex.dispose()
  }
})
test('loader rejects failed batches and disposes all successful loads', async () => {
  let disposed = 0
  class Loader {
    async loadAsync(url) {
      if (url.endsWith('grass_nr.jpg')) throw new Error('missing texture')
      const tex = new THREE.Texture()
      tex.addEventListener('dispose', () => disposed++)
      return tex
    }
  }
  await assert.rejects(load({ ...THREE, TextureLoader: Loader }).loadRuntimeTextures(), /missing texture/)
  assert.equal(disposed, 15)
})
