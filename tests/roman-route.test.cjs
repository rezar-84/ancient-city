const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

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
      window: { matchMedia: () => ({ matches: false }), addEventListener: () => {}, removeEventListener: () => {} },
      document: { createElement: () => ({ style: {} }), body: { appendChild: () => {} } },
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
  useApp.setState({ mode: 'walk', era: 'ancient', year: 200, showGrid: true })

  const { City } = loadTs('src/scene/City.tsx')
  const { CityGrid, HOUSE_RECTS, GRID_AXES } = loadTs('src/scene/CityGrid.tsx')
  const { WorldProbe } = loadTs('src/walk/physics.ts')
  const { LANDMARKS } = loadTs('src/content/landmarks.ts')
  const { PLAN } = loadTs('src/content/plan.ts')
  const { gridFrame } = loadTs('src/walk/spots.ts')
  const npcGeo = loadTs('src/walk/npcGeometry.ts')
  const { cartPose } = loadTs('src/walk/cartRoute.ts')

  const scene = new THREE.Scene()
  const cityTree = City({ terrain })
  const cityRoot = new THREE.Group(); cityRoot.name = 'city-root'
  for (const c of cityTree.props.children) cityRoot.add(c.props.object)
  scene.add(cityRoot)

  const gridTree = CityGrid({ terrain })
  function collectThree(node, parent) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(n => collectThree(n, parent)); return }
    if (node.type === 'primitive' && node.props?.object) {
      if (node.props.name) node.props.object.name = node.props.name
      parent.add(node.props.object)
      return
    }
    let next = parent
    if (node.type === 'group') {
      const grp = new THREE.Group()
      if (node.props?.name) grp.name = node.props.name
      if (node.props?.visible !== undefined) grp.visible = node.props.visible
      parent.add(grp)
      next = grp
    }
    if (node.props?.children) collectThree(node.props.children, next)
  }
  collectThree(gridTree, scene)
  for (const cb of fbs) cb({}, 0.016)
  const probe = new WorldProbe()
  probe.refresh(scene)

  function inHouse(x, z) {
    const [ux, uz] = GRID_AXES.u, [vx, vz] = GRID_AXES.v
    for (const r of HOUSE_RECTS) {
      const dx = x - r.x, dz = z - r.z
      if (Math.abs(dx * ux + dz * uz) < r.hu + 0.35 && Math.abs(dx * vx + dz * vz) < r.hv + 0.35) return true
    }
    return false
  }

  return { THREE, terrain, scene, cityRoot, probe, LANDMARKS, PLAN, gridFrame, inHouse, npcGeo, cartPose }
})

test('Frontinus Gate all three arches are bidirectionally walkable across full ±10 m approach', async () => {
  const { THREE, terrain, probe, LANDMARKS, inHouse } = await envReady
  const fg = LANDMARKS.find(l => l.id === 'frontinus-gate')
  const [gx, gz] = terrain.toLocal(fg.lat, fg.lon)
  const yaw = THREE.MathUtils.degToRad(fg.rotation ?? 0)
  for (const lx of [-4.375, 0, 4.375]) {
    for (const sign of [1, -1]) {
      let feet = null
      for (let s = -10 * sign; sign > 0 ? s <= 10 : s >= -10; s += 0.25 * sign) {
        const wx = gx + lx * Math.cos(yaw) + s * Math.sin(yaw)
        const wz = gz - lx * Math.sin(yaw) + s * Math.cos(yaw)
        const ty = terrain.heightAt(wx, wz)
        if (feet === null) feet = Math.max(ty, probe.ground(wx, wz, ty + 2.4))
        assert.equal(inHouse(wx, wz), false, `house collision on arch ${lx} at z=${s}`)
        const top = probe.ground(wx, wz, feet + 2.4)
        assert.ok(top <= feet + 0.45, `step ${top - feet}m > 0.45m on arch ${lx} at z=${s}`)
        for (const hy of [0.55, 1.35]) {
          const hit = probe.wall(wx, feet + hy, wz, Math.sin(yaw) * sign, Math.cos(yaw) * sign, 0.55, new THREE.Vector3())
          assert.equal(hit, null, `wall hit at h=${hy} on arch ${lx} z=${s}`)
        }
        feet = Math.max(ty, probe.ground(wx, wz, feet + 0.5))
      }
    }
  }
})

test('Plateia east and west porticoes and Public Latrine interior are bidirectionally walkable', async () => {
  const { THREE, terrain, probe, LANDMARKS, PLAN, inHouse } = await envReady
  const pts = PLAN.streets[0].line.map(([la, lo]) => terrain.toLocal(la, lo))
  for (const side of [-1, 1]) {
    let feet = null
    for (let seg = 1; seg < 4; seg++) {
      const [ax, az] = pts[seg - 1], [bx, bz] = pts[seg]
      const len = Math.hypot(bx - ax, bz - az)
      const ux = (bx - ax) / len, uz = (bz - az) / len
      const nx = uz, nz = -ux
      const start = seg === 1 ? 6 : 1.5
      for (let s = start; s <= len - 1.5; s += 0.5) {
        const wx = ax + ux * s + nx * side * 10.0
        const wz = az + uz * s + nz * side * 10.0
        const ty = terrain.heightAt(wx, wz)
        if (feet === null) feet = Math.max(ty, probe.ground(wx, wz, ty + 2.4))
        const top = probe.ground(wx, wz, feet + 2.4)
        assert.ok(top <= feet + 0.45, `portico side=${side} seg=${seg} step ${top - feet}m at s=${s}`)
        const hit = probe.wall(wx, feet + 1.0, wz, ux, uz, 0.55, new THREE.Vector3())
        assert.equal(hit, null, `portico side=${side} seg=${seg} wall obstruction at s=${s}`)
        feet = Math.max(ty, probe.ground(wx, wz, feet + 0.5))
      }
    }
  }

  // Latrine entrance from street -> portico -> threshold -> central aisle -> exit, plus full interior aisle
  const lat = LANDMARKS.find(l => l.id === 'latrine')
  const lyaw = THREE.MathUtils.degToRad(lat.rotation ?? 0)
  let [lx0, lz0] = terrain.toLocal(lat.lat, lat.lon)
  const back = Number(lat.builderOpts?.back ?? 0)
  lx0 -= Math.sin(lyaw) * back
  lz0 -= Math.cos(lyaw) * back

  for (const sign of [-1, 1]) {
    let feet = null
    const startZ = sign < 0 ? 18 : -1.5
    const endZ = sign < 0 ? -1.5 : 18
    for (let lz = startZ; sign < 0 ? lz >= endZ : lz <= endZ; lz += 0.25 * sign) {
      const wx = lx0 + lz * Math.sin(lyaw), wz = lz0 + lz * Math.cos(lyaw)
      const ty = terrain.heightAt(wx, wz)
      if (feet === null) feet = Math.max(ty, probe.ground(wx, wz, ty + 2.4))
      assert.equal(inHouse(wx, wz), false)
      const top = probe.ground(wx, wz, feet + 2.4)
      assert.ok(top <= feet + 0.45, `latrine step ${top - feet}m at lz=${lz}`)
      for (const hy of [0.55, 1.35]) {
        const hit = probe.wall(wx, feet + hy, wz, Math.sin(lyaw) * sign, Math.cos(lyaw) * sign, 0.55, new THREE.Vector3())
        assert.equal(hit, null, `latrine wall hit at lz=${lz}, h=${hy}`)
      }
      feet = Math.max(ty, probe.ground(wx, wz, feet + 0.5))
    }
  }
  // Walk full 32 m central aisle inside the latrine along local X at lz = 0
  let aisleFeet = null
  for (let lx = -16; lx <= 16; lx += 0.5) {
    const wx = lx0 + lx * Math.cos(lyaw), wz = lz0 - lx * Math.sin(lyaw)
    const ty = terrain.heightAt(wx, wz)
    if (aisleFeet === null) aisleFeet = Math.max(ty, probe.ground(wx, wz, ty + 2.4))
    const hit = probe.wall(wx, aisleFeet + 1.0, wz, Math.cos(lyaw), -Math.sin(lyaw), 0.55, new THREE.Vector3())
    assert.equal(hit, null, `latrine central aisle blocked at lx=${lx}`)
    aisleFeet = Math.max(ty, probe.ground(wx, wz, aisleFeet + 0.5))
  }
})

test('Roman cart shafts, wheel gauge, and detailed horse harness align across straightaways and turns', async () => {
  const { npcGeo, cartPose } = await envReady
  const cart = npcGeo.createCartGeometry()
  const horse = npcGeo.createHorseGeometry()
  const detailed = npcGeo.createDetailedHorseHarness()
  assert.ok(cart.boundingBox.min.y >= -0.001)
  // Cart shaft front tips reach z >= 2.75 m so at 2.6 m trailing distance they meet horse tug loops at z ~ +0.20 m
  assert.ok(cart.boundingBox.max.z >= 2.75 && cart.boundingBox.max.z <= 2.95)
  assert.ok(cart.boundingBox.max.x >= 0.74 && cart.boundingBox.max.x <= 0.88)
  assert.ok(detailed.body.children.length >= 10)
  assert.ok(detailed.head.children.length >= 5)
  for (const s of [0, 80, 240, 244, 520]) {
    const lead = cartPose(s, 300), axle = cartPose(s - 2.6, 300)
    const dist = Math.hypot(lead.u - axle.u, lead.v - axle.v)
    assert.ok(dist > 2.3 && dist < 2.65, `unexpected horse-cart coupling distance ${dist} at s=${s}`)
  }
  cart.dispose(); horse.dispose(); detailed.dispose()
})
