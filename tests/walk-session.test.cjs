const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function compile(path, requireFn = require, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8').replaceAll('import.meta.env.DEV', 'false'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const context = { exports: {}, require: requireFn, ...globals }
  vm.runInNewContext(code, context)
  return context.exports
}
function setup() {
  const { useApp, walkInputBlocked } = compile('src/store.ts', require, { navigator: { language: 'en' }, localStorage: { getItem: () => null } })
  const character = { id: 'test-citizen', year: 200 }
  const api = compile('src/walk/CharacterSelect.tsx', id => {
    if (id === '../store') return { useApp }
    if (id === '../content/characters') return { CHARACTERS: [character] }
    if (id === '../ui/ambient') return { startAmbient: () => {} }
    if (id === '../ui/TopBar') return { LangSwitch: () => null }
    if (id === '../audio/characterVoice') return { playCharacterClip: () => false, speakCharacterLine: () => false, stopCharacterVoice: () => {}, voiceSupported: () => false }
    return require(id)
  })
  return { ...api, useApp, character, walkInputBlocked }
}
test('new walk resets the saved session and sets the selected period', () => {
  const { beginWalk, useApp, character } = setup()
  useApp.setState({ walkSession: true, walkPaused: true, era: 'today', selected: 'theatre' })
  beginWalk(character)
  const s = useApp.getState()
  assert.equal(s.walkSession, false)
  assert.equal(s.walkPaused, false)
  assert.equal(s.character, character.id)
  assert.equal(s.year, 200)
  assert.equal(s.era, 'ancient')
  assert.equal(s.mode, 'walk')
  assert.equal(s.selected, null)
  assert.equal(s.showGrid, true)
})
test('resume retains the session while restoring its period and clearing overlays', () => {
  const { resumeWalk, useApp, character } = setup()
  useApp.setState({ walkSession: true, walkPaused: true, character: character.id, year: 500, mode: 'choose', selected: 'theatre' })
  resumeWalk()
  const s = useApp.getState()
  assert.equal(s.walkSession, true)
  assert.equal(s.walkPaused, false)
  assert.equal(s.year, 200)
  assert.equal(s.mode, 'walk')
  assert.equal(s.selected, null)
})
test('resume without a session leaves character selection open', () => {
  const { resumeWalk, useApp } = setup()
  useApp.setState({ mode: 'choose' })
  resumeWalk()
  assert.equal(useApp.getState().mode, 'choose')
})

test('all walk overlays block input until dismissed', () => {
  const { useApp, walkInputBlocked } = setup()
  useApp.getState().setMode('walk')
  assert.equal(walkInputBlocked(useApp.getState()), false)
  for (const overlay of ['map', 'settings']) {
    useApp.getState().setWalkOverlay(overlay)
    assert.equal(walkInputBlocked(useApp.getState()), true)
    useApp.getState().walkEscape()
    assert.equal(useApp.getState().walkOverlay, null)
    assert.equal(useApp.getState().walkPaused, false)
    assert.equal(walkInputBlocked(useApp.getState()), false)
  }
})
test('Escape dismisses place information before pausing and resuming', () => {
  const { useApp, walkInputBlocked } = setup()
  useApp.getState().setMode('walk')
  useApp.getState().select('theatre')
  useApp.getState().walkEscape()
  assert.equal(useApp.getState().selected, null)
  assert.equal(useApp.getState().walkPaused, false)
  useApp.getState().walkEscape()
  assert.equal(walkInputBlocked(useApp.getState()), true)
  useApp.getState().walkEscape()
  assert.equal(walkInputBlocked(useApp.getState()), false)
})
test('leaving and re-entering walk mode clears stale overlays', () => {
  const { useApp, walkInputBlocked } = setup()
  useApp.getState().setMode('walk')
  useApp.getState().setWalkOverlay('settings')
  useApp.getState().setMode('explore')
  assert.equal(useApp.getState().walkOverlay, null)
  assert.equal(walkInputBlocked(useApp.getState()), true)
  useApp.getState().setMode('walk')
  assert.equal(walkInputBlocked(useApp.getState()), false)
})
