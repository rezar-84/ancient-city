const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup({ hidden = false, interrupt = false, adaptive = false } = {}) {
  const source = fs.readFileSync('src/scene/captureRenders.ts', 'utf8').replaceAll('import.meta.env.DEV', 'true')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const listeners = new Map()
  let frame = 0
  const doc = { hidden, addEventListener: (k, v) => listeners.set(k, v), removeEventListener: k => listeners.delete(k) }
  const context = {
    exports: {}, require: () => ({}), window: {}, document: doc,
    requestAnimationFrame: callback => queueMicrotask(() => {
      frame++
      if (interrupt && frame === 4) { doc.hidden = true; listeners.get('visibilitychange')?.() }
      callback(frame * 20)
    }),
  }
  vm.runInNewContext(js, context)
  context.exports.installCapture({
    getPixelRatio: () => adaptive && frame > 10 ? 0.8 : 1,
    info: { render: { calls: 5 }, memory: {} }, domElement: { width: 1280, height: 800 },
  }, {})
  return { run: context.window.__benchmark, listeners, doc }
}

test('fixed-quality run measures complete frames and releases listeners', async () => {
  const { run, listeners } = setup()
  const result = await run()
  assert.equal(result.medianMs, 20)
  assert.equal(result.p95Ms, 20)
  assert.equal(result.frames, 1000)
  assert.equal(result.qualityChanged, false)
  assert.equal(listeners.size, 0)
})
test('adaptive resolution is disclosed', async () => {
  const result = await setup({ adaptive: true }).run()
  assert.equal(result.qualityChanged, true)
  assert.equal(result.dprRange[0], 0.8)
  assert.equal(result.dprRange[1], 1)
})
test('hidden and interrupted runs are rejected', async () => {
  await assert.rejects(setup({ hidden: true }).run(), /visible/)
  const state = setup({ interrupt: true })
  await assert.rejects(state.run(), /interrupted/)
  assert.equal(state.listeners.size, 0)
  state.doc.hidden = false
  assert.equal((await state.run()).qualityChanged, false)
})
test('concurrent runs are rejected', async () => {
  const { run } = setup()
  const first = run()
  await assert.rejects(run(), /already running/)
  await first
})
