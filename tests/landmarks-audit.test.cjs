const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const EXPECTED_IDS = [
  'travertines',
  'frontinus-gate',
  'frontinus-street',
  'necropolis',
  'latrine',
  'agora',
  'byzantine-gate-n',
  'tritons',
  'baths',
  'cathedral',
  'antique-pool',
  'apollo',
  'ploutonion',
  'theatre',
  'martyrium',
  'philip-church',
  'south-gate',
]

const envReady = Promise.all([
  import('three'),
  import('three/examples/jsm/utils/BufferGeometryUtils.js'),
  import('three-mesh-bvh'),
]).then(([THREE, BGU, BVH]) => {
  const fbs = []
  const cache = new Map()
  function loadTs(relPath) {
    const full = path.resolve(relPath)
    if (cache.has(full)) return cache.get(full).exports
    const src = fs.readFileSync(full, 'utf8').replaceAll('import.meta.env.DEV', 'false')
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const mod = { exports: {} }
    cache.set(full, mod)
    const localRequire = (id) => {
      if (id === 'three') return THREE
      if (id === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BGU
      if (id === 'three-mesh-bvh') return BVH
      if (id === '@react-three/drei') return { Html: () => null }
      if (id === 'react') {
        return {
          useMemo: (fn) => fn(),
          useEffect: () => {},
          useRef: (v) => ({ current: v }),
          useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
        }
      }
      if (id === '../store') {
        const st = loadTs('src/store.ts')
        const fn = (sel) => sel(st.useApp.getState())
        Object.assign(fn, st.useApp)
        return { ...st, useApp: fn }
      }
      if (id === '@react-three/fiber') return { useFrame: (cb) => { fbs.push(cb) }, useThree: () => ({}) }
      if (id === 'react/jsx-runtime') {
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
          Fragment: 'Fragment',
        }
      }
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(full), id)
        for (const cand of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
          if (fs.existsSync(cand)) return loadTs(cand)
        }
      }
      return require(id)
    }
    vm.runInNewContext(js, {
      exports: mod.exports,
      module: mod,
      require: localRequire,
      Float32Array, Uint16Array, Uint32Array, Uint8Array, Int32Array, ArrayBuffer,
      navigator: { language: 'en' },
      localStorage: { getItem: () => null, setItem: () => {} },
      window: { matchMedia: () => ({ matches: false }) },
      document: {},
      console,
    }, { filename: full })
    return mod.exports
  }

  const meta = JSON.parse(fs.readFileSync('public/terrain/meta.json', 'utf8'))
  const buf = fs.readFileSync('public/terrain/height.bin')
  const heights = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  const { terrainCellHeight } = loadTs('src/scene/terrainData.ts')
  const g = meta.grid
  const terrain = {
    meta,
    heights,
    heightAt: (x, z) => {
      const u = (x / meta.widthM + 0.5) * (g - 1)
      const v = (z / meta.depthM + 0.5) * (g - 1)
      const i = Math.min(Math.max(u | 0, 0), g - 2)
      const j = Math.min(Math.max(v | 0, 0), g - 2)
      const fu = Math.min(Math.max(u - i, 0), 1), fv = Math.min(Math.max(v - j, 0), 1)
      const h00 = heights[j * g + i], h10 = heights[j * g + i + 1]
      const h01 = heights[(j + 1) * g + i], h11 = heights[(j + 1) * g + i + 1]
      return terrainCellHeight(h00, h10, h01, h11, fu, fv) - meta.minH
    },
    toLocal: (lat, lon) => [(lon - meta.lon0) * meta.mPerDegLon, -(lat - meta.lat0) * meta.mPerDegLat],
    toLatLon: (x, z) => [meta.lat0 - z / meta.mPerDegLat, meta.lon0 + x / meta.mPerDegLon],
  }

  const { useApp } = loadTs('src/store.ts')
  useApp.setState({ mode: 'walk', era: 'ancient', year: 200 })

  const { City } = loadTs('src/scene/City.tsx')
  const { WorldProbe } = loadTs('src/walk/physics.ts')
  const { LANDMARKS } = loadTs('src/content/landmarks.ts')
  const { CHARACTERS } = loadTs('src/content/characters.ts')
  const { PLAN_VIEW } = loadTs('src/content/plan.ts')

  const scene = new THREE.Scene()
  const cityTree = City({ terrain })
  const cityRoot = new THREE.Group(); cityRoot.name = 'city-root'
  for (const c of cityTree.props.children) cityRoot.add(c.props.object)
  scene.add(cityRoot)
  const runFrames = () => { for (const cb of fbs) cb({}, 0.016) }
  runFrames()
  const probe = new WorldProbe()
  probe.refresh(scene)

  return { THREE, terrain, scene, cityRoot, probe, useApp, runFrames, LANDMARKS, CHARACTERS, PLAN_VIEW }
})

test('all 17 numbered landmarks and 6 playable characters preserve IDs, sources, and 45 scene pieces', async () => {
  const { cityRoot, LANDMARKS, CHARACTERS } = await envReady
  assert.deepEqual(Array.from(LANDMARKS, l => l.id), EXPECTED_IDS)
  assert.equal(cityRoot.children.length, 45)
  for (const l of LANDMARKS) {
    assert.ok(l.name.en && l.name.tr)
    assert.ok(l.facts.en.length >= 1 && l.facts.tr.length >= 1)
    assert.ok(l.sources.length >= 1)
  }
  assert.deepEqual(Array.from(CHARACTERS, c => c.id), ['theano', 'nikias', 'aurelia', 'ammianos', 'eudokia', 'philippos'])
})

test('era-specific sanctuary phases and accessible monument interiors hold across 150 BC, AD 200, and AD 500', async () => {
  const { THREE, terrain, cityRoot, probe, useApp, runFrames, LANDMARKS, PLAN_VIEW } = await envReady
  const apolloObj = cityRoot.children.find(o => o.userData.landmark === 'apollo')
  assert.ok(apolloObj && apolloObj.userData.eraPhases)

  // 150 BC: Hellenistic Doric/Ionic sanctuary of Apollo stands; Roman phase hidden
  useApp.setState({ mode: 'walk', era: 'ancient', year: -150 })
  runFrames()
  assert.equal(apolloObj.visible, true)
  assert.equal(apolloObj.userData.eraPhases.hellenistic.visible, true)
  assert.equal(apolloObj.userData.eraPhases.roman.visible, false)

  // AD 200: Roman Severan marble Temple of Apollo stands; Theatre central porta regia is unobstructed
  useApp.setState({ year: 200 })
  runFrames()
  assert.equal(apolloObj.userData.eraPhases.hellenistic.visible, false)
  assert.equal(apolloObj.userData.eraPhases.roman.visible, true)

  const theatre = LANDMARKS.find(l => l.id === 'theatre')
  const [tx, tz] = terrain.toLocal(theatre.lat, theatre.lon)
  const tyaw = THREE.MathUtils.degToRad(theatre.rotation ?? 0)
  const or = Number(theatre.builderOpts?.outerRadius ?? 51.5)
  const sd = Number(theatre.builderOpts?.stageDepth ?? 12)
  const stageZ = Math.max(13, or * 0.3), frontZ = stageZ - sd / 2
  const tGroup = cityRoot.children.find(o => o.userData.landmark === 'theatre')
  const stageFloorY = tGroup.position.y + 1.6
  // Raycast right through central porta regia (x=0, z = frontZ - 2 -> frontZ + 2) at chest height
  const pStartX = tx + (frontZ - 2.2) * Math.sin(tyaw), pStartZ = tz + (frontZ - 2.2) * Math.cos(tyaw)
  const portaHit = probe.wall(pStartX, stageFloorY + 1.2, pStartZ, Math.sin(tyaw), Math.cos(tyaw), 4.4, new THREE.Vector3())
  assert.equal(portaHit, null, 'Theatre central porta regia must not be blocked by scaenae overlay')

  // AD 500: Byzantine Cathedral, Martyrium, St Philip Church, and both Byzantine Gates stand with clear floors above terrain
  useApp.setState({ year: 500 })
  runFrames()
  for (const id of ['cathedral', 'martyrium', 'philip-church', 'byzantine-gate-n', 'south-gate', 'baths', 'agora']) {
    const l = LANDMARKS.find(x => x.id === id)
    const obj = cityRoot.children.find(o => o.userData.landmark === id)
    assert.ok(obj && obj.visible, `${id} must be visible in AD 500`)
    let [cx, cz] = terrain.toLocal(l.lat, l.lon)
    const yaw = THREE.MathUtils.degToRad(l.rotation ?? 0)
    const back = Number(l.builderOpts?.back ?? 0)
    if (back) { cx -= Math.sin(yaw) * back; cz -= Math.cos(yaw) * back }
    const ty = terrain.heightAt(cx, cz)
    const floorY = probe.ground(cx, cz, ty + 6)
    assert.ok(floorY >= ty - 0.15, `${id} interior floor (${floorY}) must not be buried under terrain (${ty})`)
  }

  // Printable plan view bounds contain all 17 numbered landmarks so plan pins match 3D map pins
  for (const l of LANDMARKS) {
    assert.ok(l.lat >= PLAN_VIEW.s && l.lat <= PLAN_VIEW.n, `${l.id} lat outside printable PLAN_VIEW`)
    assert.ok(l.lon >= PLAN_VIEW.w && l.lon <= PLAN_VIEW.e, `${l.id} lon outside printable PLAN_VIEW`)
  }
})
