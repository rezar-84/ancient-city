const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let THREE
const setup = Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/utils/SkeletonUtils.js'), import('three'), import('three/examples/jsm/libs/meshopt_decoder.module.js')]).then(async ([loader, skeleton, three, meshopt]) => {
  THREE = three
  // The packaged GLBs use lossless EXT_meshopt_compression (float attributes kept, no quantization).
  await meshopt.MeshoptDecoder.ready
  const code = ts.transpileModule(fs.readFileSync('src/walk/riggedCitizen.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, require: id => id === 'three' ? THREE : id.includes('GLTFLoader') ? loader : id.includes('meshopt') ? meshopt : skeleton }
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
    return new loader.GLTFLoader().setMeshoptDecoder(meshopt.MeshoptDecoder).parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '')
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

test('Hellenistic, Roman, and Byzantine garments differentiate cuts, linen/wool weaves, roles, and rear/side stride clearance', async () => {
  const { instantiateCitizen, male, female, motions } = await setup
  const greek = instantiateCitizen(male, motions, 'greek', palette(), 'm')
  const roman = instantiateCitizen(male, motions, 'roman', palette(), 'm')
  const byz = instantiateCitizen(female, motions, 'byzantine', palette(), 'f')

  // Hem heights progress from shorter Hellenistic chiton -> Roman tunica -> longer Byzantine dalmatica
  const hemOf = (c) => {
    const g = c.root.getObjectByName('SimulatedTunic').geometry.getAttribute('position')
    let minY = Infinity
    for (let i = 0; i < g.count; i++) minY = Math.min(minY, g.getY(i))
    return minY
  }
  assert.ok(hemOf(greek) > hemOf(roman) && hemOf(roman) > hemOf(byz), 'era hems must be historically differentiated')

  // Linen vs wool fabric properties
  roman.setFabric('linen')
  const clothMat = roman.root.getObjectByName('SimulatedTunic').material
  assert.ok(clothMat.roughness < 0.78 && clothMat.userData.uWeave.value === 0)
  roman.setFabric('wool')
  assert.ok(clothMat.roughness > 0.90 && clothMat.userData.uWeave.value === 1)

  // Soldier fits equipment belt independently; merchant, porter, resident, pilgrim toggle distinct gear
  for (const role of ['soldier', 'merchant', 'porter', 'resident', 'pilgrim', 'priest']) {
    roman.configure({ role, cut: role === 'resident' || role === 'pilgrim' ? 'full' : 'work', fabric: role === 'porter' ? 'linen' : 'wool', age: role === 'merchant' ? 'older' : 'adult' })
    assert.equal(roman.role, role)
  }

  // Rear and side motion check across short, tall, and older builds during walk, jog, and forward work bend
  for (const [stature, build, age, speed, bend] of [
    [0.92, 0.95, 'adult', 1.4, 0],
    [1.05, 1.02, 'adult', 4.5, 0],
    [0.95, 1.10, 'older', 0, 0.55],
  ]) {
    roman.configure({ role: 'merchant', cut: 'work', fabric: 'linen', age })
    roman.root.scale.set(build, stature, build)
    for (let f = 0; f < 40; f++) roman.update(1 / 60, { speed, grounded: true, wave: false, look: 0, bend, groundAt: () => 0 })
    const pos = roman.root.getObjectByName('SimulatedTunic').geometry.getAttribute('position')
    assert.ok(Array.from(pos.array).every(Number.isFinite))
    let minZ = Infinity, maxZ = -Infinity
    for (let i = 25; i < pos.count; i++) { minZ = Math.min(minZ, pos.getZ(i)); maxZ = Math.max(maxZ, pos.getZ(i)) }
    assert.ok(maxZ - minZ > 0.22, `side profile depth ${maxZ - minZ} must stay open during motion`)
  }

  greek.dispose(); roman.dispose(); byz.dispose()
})

test('children and adolescents scale head/cadence independently and merchant reach/step poses stay finite', async () => {
  const { instantiateCitizen, male, motions } = await setup
  const citizen = instantiateCitizen(male, motions, 'roman', palette())
  const head = citizen.root.getObjectByName('Head')
  assert.ok(head, 'citizen skeleton must expose Head bone')

  citizen.configure({ role: 'resident', cut: 'full', fabric: 'linen', age: 'child' })
  citizen.update(1 / 60, { speed: 0, grounded: true, wave: false, look: 0 })
  assert.ok(head.scale.x > 1.1, `child head proportion (${head.scale.x}) should be larger than adult`)
  const childPos = citizen.root.getObjectByName('SimulatedTunic').geometry.getAttribute('position')
  let childMinY = Infinity
  for (let i = 0; i < childPos.count; i++) childMinY = Math.min(childMinY, childPos.getY(i))

  citizen.configure({ role: 'resident', cut: 'full', fabric: 'linen', age: 'adult' })
  citizen.update(1 / 60, { speed: 0, grounded: true, wave: false, look: 0 })
  assert.equal(head.scale.x, 1)
  let adultMinY = Infinity
  for (let i = 0; i < childPos.count; i++) adultMinY = Math.min(adultMinY, childPos.getY(i))
  assert.ok(childMinY > adultMinY + 0.05, 'child tunic hem must stay shorter than adult full tunic')

  citizen.configure({ role: 'resident', cut: 'full', fabric: 'linen', age: 'adolescent' })
  assert.ok(head.scale.x > 1.02 && head.scale.x < 1.1)

  // Merchant reaching over a counter + stepping up a 0.22 m step
  citizen.configure({ role: 'merchant', cut: 'work', fabric: 'linen', age: 'adult' })
  const armR = citizen.root.getObjectByName('upperarm_r')
  const restQuat = armR.quaternion.clone()
  for (let f = 0; f < 25; f++) {
    citizen.update(1 / 60, { speed: 0, grounded: true, wave: false, look: 0, bend: 0.22, reach: 0.88, groundAt: () => 0 })
  }
  assert.ok(armR.quaternion.angleTo(restQuat) > 0.25, 'merchant reach must rotate upperarm_r forward')
  for (let f = 0; f < 25; f++) {
    citizen.update(1 / 60, { speed: 1.25, grounded: true, wave: false, look: 0, groundAt: (_x, z) => (z > 0.08 ? 0.22 : 0) })
  }
  assert.ok(Array.from(childPos.array).every(Number.isFinite))

  citizen.dispose()
})

test('rigs keep frustum culling with a fixed sphere, accessories skip shadows, and off-screen updates defer animation', async () => {
  const { instantiateCitizen, male, motions, CITIZEN_DETAIL } = await setup
  const c = instantiateCitizen(male, motions, 'roman', palette())
  c.configure({ role: 'soldier', cut: 'work', fabric: 'wool', age: 'adult' })
  const cloth = c.root.getObjectByName('SimulatedTunic')
  let casters = 0
  c.root.traverse(o => {
    if (!o.isMesh) return
    assert.notEqual(o.frustumCulled, false, `${o.name} must stay frustum culled`)
    if (o.isSkinnedMesh) assert.ok(o.boundingSphere && o.boundingSphere.radius > 0, 'skinned parts carry a fixed bounding sphere')
    if (o.castShadow) casters++
  })
  assert.ok(cloth.geometry.boundingSphere.radius > 0)
  assert.ok(casters <= 4, `only body, tunic top, skirt and simulated hem cast shadows (got ${casters})`)
  const arm = c.root.getObjectByName('upperarm_l')
  for (let i = 0; i < 10; i++) c.update(1 / 60, { speed: 1.5, grounded: true, wave: false, look: 0 })
  const before = arm.quaternion.clone()
  for (let i = 0; i < 10; i++) c.update(1 / 60, { speed: 1.5, grounded: true, wave: false, look: 0 }, CITIZEN_DETAIL.offscreen)
  assert.ok(arm.quaternion.equals(before), 'off-screen rigs do not run the mixer')
  c.update(1 / 60, { speed: 1.5, grounded: true, wave: false, look: 0 }, CITIZEN_DETAIL.animated)
  assert.ok(!arm.quaternion.equals(before), 'deferred time is applied when the rig is seen again')
  assert.equal(cloth.visible, false, 'distant rigs show the skinned hem instead of the simulated one')
  c.update(1 / 60, { speed: 1.5, grounded: true, wave: false, look: 0 })
  assert.equal(cloth.visible, true)
  assert.ok(Array.from(cloth.geometry.getAttribute('position').array).every(Number.isFinite))
  c.dispose()
})
