const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let THREE
const setup = Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/utils/SkeletonUtils.js'), import('three')]).then(async ([loader, skeleton, three]) => {
  THREE = three
  const code = ts.transpileModule(fs.readFileSync('src/walk/riggedCitizen.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, require: id => id === 'three' ? THREE : id.includes('GLTFLoader') ? loader : skeleton }
  vm.runInNewContext(code, context)
  async function load(name) {
    const raw = fs.readFileSync(`public/models/citizens/${name}.glb`), length = raw.readUInt32LE(12)
    const json = JSON.parse(raw.subarray(20, 20 + length).toString())
    // CPU skinning tests don't create a renderer or decode textures.
    for (const m of json.materials ?? []) { m.pbrMetallicRoughness = { baseColorFactor: [1, 1, 1, 1] }; delete m.normalTexture; delete m.occlusionTexture }
    delete json.images; delete json.textures
    const chunk = Buffer.from(JSON.stringify(json)); const padding = Buffer.alloc((4 - chunk.length % 4) % 4, 32)
    const binary = raw.subarray(20 + length)
    const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + chunk.length + padding.length + binary.length, 8); header.writeUInt32LE(chunk.length + padding.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
    const result = Buffer.concat([header, chunk, padding, binary])
    return new loader.GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '')
  }
  return { ...context.exports, male: await load('male'), female: await load('female'), motions: await load('motions') }
})
const palette = () => ({ cloth: new THREE.Color('#ad8053'), accent: new THREE.Color('#773d35'), skin: new THREE.Color('#b98860') })

test('both imported models animate independently with normalized skin weights and finite geometry', async () => {
  const { instantiateCitizen, male, female, motions } = await setup
  for (const model of [male, female]) {
    const citizen = instantiateCitizen(model, motions, 'roman', palette())
    const idle = instantiateCitizen(model, motions, 'roman', palette())
    const initial = idle.root.getObjectByName('upperarm_l').quaternion.clone()
    for (const speed of [0, 1.5, 4.6, 7.5, 0]) {
      for (let i = 0; i < 30; i++) citizen.update(1 / 60, { speed, grounded: true, wave: false, look: 0 })
      citizen.root.updateMatrixWorld(true)
      citizen.root.traverse(o => {
        if (!o.isSkinnedMesh) return
        o.skeleton.update()
        const weights = o.geometry.getAttribute('skinWeight')
        for (let i = 0; i < weights.count; i++) assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 0.001)
        o.computeBoundingBox()
        assert.ok([...o.boundingBox.min.toArray(), ...o.boundingBox.max.toArray()].every(Number.isFinite))
      })
    }
    assert.ok(idle.root.getObjectByName('upperarm_l').quaternion.equals(initial))
    assert.equal(citizen.action, 'Idle_Loop')
    citizen.dispose(); idle.dispose()
  }
})
test('jump, landing, greeting, and pool reuse select the intended imported clips', async () => {
  const { instantiateCitizen, male, motions } = await setup
  const c = instantiateCitizen(male, motions, 'greek', palette())
  const update = (speed, grounded, wave = false) => c.update(0.05, { speed, grounded, wave, look: 0 })
  update(0, false); assert.equal(c.action, 'Jump_Start')
  for (let i = 0; i < 10; i++) update(0, false)
  assert.equal(c.action, 'Jump_Loop')
  update(0, true); assert.equal(c.action, 'Jump_Land')
  for (let i = 0; i < 5; i++) update(0, true)
  update(0, true, true); assert.equal(c.action, 'Idle_Talking_Loop')
  c.reset(); assert.equal(c.action, 'Idle_Loop')
  c.dispose()
})
test('curated clips preserve bind pose metadata and package stays within the initial download budget', async () => {
  const { motions } = await setup
  assert.equal(motions.animations.length, 12)
  for (const animation of motions.parser.json.animations) assert.ok(animation.extras.bindPose.pelvis)
  let bytes = 0
  for (const file of ['male', 'female', 'motions']) bytes += fs.statSync(`public/models/citizens/${file}.glb`).size
  assert.ok(bytes < 8 * 1024 * 1024)
})

test('foot IK raises each ankle toward terrain and releases it while airborne', async () => {
  const { instantiateCitizen, male, motions } = await setup
  const plain = instantiateCitizen(male, motions, 'roman', palette())
  const ik = instantiateCitizen(male, motions, 'roman', palette())
  const motion = { speed: 0, grounded: true, wave: false, look: 0 }
  for (let i = 0; i < 30; i++) {
    plain.update(1 / 60, motion)
    ik.update(1 / 60, { ...motion, groundAt: () => 0.12 })
  }
  for (const side of ['l', 'r']) {
    const a = plain.root.getObjectByName(`foot_${side}`).getWorldPosition(new THREE.Vector3())
    const b = ik.root.getObjectByName(`foot_${side}`).getWorldPosition(new THREE.Vector3())
    assert.ok(b.y > a.y + 0.05, 'ankle should rise on a raised surface')
    assert.ok(Math.abs(b.x - a.x) < 0.03 && Math.abs(b.z - a.z) < 0.03)
  }
  plain.update(1 / 60, { ...motion, grounded: false })
  ik.update(1 / 60, { ...motion, grounded: false, groundAt: () => 0.12 })
  for (const side of ['l', 'r']) assert.ok(plain.root.getObjectByName(`foot_${side}`).getWorldPosition(new THREE.Vector3()).distanceTo(ik.root.getObjectByName(`foot_${side}`).getWorldPosition(new THREE.Vector3())) < 1e-5)
  plain.dispose(); ik.dispose()
})

test('cloth stays finite with welded seams, pinned waist and reset after teleport', async () => {
  const { instantiateCitizen, female, motions } = await setup
  const citizen = instantiateCitizen(female, motions, 'byzantine', palette())
  const cloth = citizen.root.getObjectByName('SimulatedTunic')
  const pos = cloth.geometry.getAttribute('position')
  for (let frame = 0; frame < 120; frame++) {
    citizen.root.position.z += 0.02
    citizen.root.rotation.y = Math.sin(frame / 30) * 0.5
    citizen.update(frame === 60 ? 2 : 1 / 60, { speed: 1.2, grounded: true, wave: false, look: 0, groundAt: () => 0 })
    assert.ok(Array.from(pos.array).every(Number.isFinite))
    for (let row = 0; row < 6; row++) assert.ok(new THREE.Vector3().fromBufferAttribute(pos, row * 25).distanceTo(new THREE.Vector3().fromBufferAttribute(pos, row * 25 + 24)) < 1e-6)
  }
  const source = citizen.root.getObjectByName('SimulatedTunic').parent.children.find(o => o.isSkinnedMesh && !o.visible)
  for (let i = 0; i < 24; i++) {
    const pinned = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(cloth.matrixWorld)
    const animated = source.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(source.matrixWorld)
    assert.ok(pinned.distanceTo(animated) < 1e-5)
  }
  citizen.reset(); citizen.root.position.set(100, 0, 100)
  citizen.update(1 / 60, { speed: 0, grounded: true, wave: false, look: 0 })
  const bounds = new THREE.Box3().setFromBufferAttribute(pos)
  assert.ok(bounds.getSize(new THREE.Vector3()).length() < 3, 'teleport must not stretch cloth')
  citizen.dispose()
})

test('tunic rear panel clears the body at hip height on both figures', async () => {
  const { instantiateCitizen, male, female, motions } = await setup
  for (const model of [male, female]) {
    const citizen = instantiateCitizen(model, motions, 'roman', palette())
    let body
    model.scene.traverse(o => {
      if (o.isSkinnedMesh && (!body || o.geometry.getAttribute('position').count > body.geometry.getAttribute('position').count)) body = o
    })
    const vertices = body.geometry.getAttribute('position')
    let rearBody = Infinity
    for (let i = 0; i < vertices.count; i++) {
      const y = vertices.getY(i)
      if (y > 0.72 && y < 0.93 && Math.abs(vertices.getX(i)) < 0.23)
        rearBody = Math.min(rearBody, vertices.getZ(i))
    }
    const garment = citizen.root.getObjectByName('SimulatedTunic').geometry.getAttribute('position')
    let rearCloth = Infinity
    for (let i = 0; i < garment.count; i++) {
      const y = garment.getY(i)
      if (y > 0.72 && y < 0.93) rearCloth = Math.min(rearCloth, garment.getZ(i))
    }
    assert.ok(rearCloth < rearBody - 0.05, `rear cloth must cover the hip: ${rearCloth} < ${rearBody}`)
    citizen.dispose()
  }
})
