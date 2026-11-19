const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(path) {
  const context = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const moves = load('src/walk/moves.ts')
const route = load('src/walk/cartRoute.ts')
const GRAVITY = 18, DT = 1 / 60

/** Flat-ground flight with WalkControls' airborne steering (accel 2.6, long jump steered at 25%). */
function jumpDistance(gait, speed) {
  const launch = moves.jumpLaunch(gait, 0, -speed, speed)
  let x = 0, z = 0, y = 0, vx = launch.vx, vz = launch.vz, vy = launch.vy
  const want = [0, -Math.min(speed, 7.5)]
  do {
    const [tx, tz] = launch.long ? moves.longJumpSteer(launch.vx, launch.vz, want[0], want[1]) : want
    vx += (tx - vx) * Math.min(1, 2.6 * DT); vz += (tz - vz) * Math.min(1, 2.6 * DT)
    vy -= GRAVITY * DT
    x += vx * DT; z += vz * DT; y += vy * DT
  } while (y > 0)
  return { distance: Math.hypot(x, z), launch }
}

test('a sprinting long jump carries further than a normal jump on flat ground', () => {
  const normal = jumpDistance('walk', 2)
  const runJump = jumpDistance('sprint', 7.5)
  assert.equal(normal.launch.long, false)
  assert.equal(normal.launch.vy, moves.JUMP_V)
  assert.equal(runJump.launch.long, true)
  assert.equal(runJump.launch.vy, 6.2)
  assert.ok(Math.abs(Math.hypot(runJump.launch.vx, runJump.launch.vz) - 9.5) < 1e-9, 'carry is capped at 9.5 m/s')
  // even at the same run-up speed the long jump beats a plain jump
  const plainAtSprint = jumpDistance('walk', 7.5)
  assert.ok(runJump.distance > plainAtSprint.distance + 1, `${runJump.distance} vs ${plainAtSprint.distance}`)
  assert.ok(runJump.distance > normal.distance)
})

test('long jump needs a run gait and more than 4 m/s', () => {
  assert.equal(moves.jumpLaunch('run', 0, 3.9, 3.9).long, false)
  assert.equal(moves.jumpLaunch('walk', 0, 6, 6).long, false)
  const run = moves.jumpLaunch('run', 4.6, 0, 4.6)
  assert.equal(run.long, true)
  assert.ok(Math.abs(run.vx - 4.6 * 1.3) < 1e-9 && run.vz === 0)
})

test('roll dashes forward, decays to 2 m/s, and is stopped by a wall', () => {
  assert.equal(moves.rollSpeed(0, 1), 5.5)
  assert.equal(moves.rollSpeed(0, 7.5), 7.5)
  assert.ok(Math.abs(moves.rollSpeed(1, 7.5) - 2) < 1e-9)
  const roll = (wallZ) => {
    let x = 0, z = 0, hit = false
    const ok = (nx, nz) => wallZ === undefined || nz > wallZ + 0.35 // walker radius against a wall at z = wallZ
    for (let t = 0; t < moves.ROLL.duration; t += DT) {
      const v = moves.rollSpeed(t / moves.ROLL.duration, 0)
      const r = moves.slideMove(x, z, 0, -v * DT, ok)
      hit = hit || r.z > z - v * DT + 1e-9 // fell short of the full step
      x = r.x; z = r.z
    }
    return { x, z, hit }
  }
  const open = roll()
  assert.ok(-open.z > 1.8 && -open.z < 3.5, `rolled ${-open.z} m`)
  const walled = roll(-1)
  assert.ok(walled.hit)
  assert.ok(walled.z > -1 + 0.34 && walled.z < 0, `stopped at ${walled.z}`)
  // wall sliding still lets a diagonal roll slide along the wall
  const slid = moves.slideMove(0, 0, 0.5, -0.5, (nx, nz) => nz > -0.2)
  assert.equal(slid.blocked, false); assert.equal(slid.x, 0.5); assert.equal(slid.z, 0)
  const c = moves.rollCurve(0.5)
  assert.ok(Math.abs(c.angle - Math.PI) < 1e-9 && Math.abs(c.drop - 1) < 1e-9)
  assert.ok(Math.abs(moves.rollCurve(1).angle - Math.PI * 2) < 1e-9 && moves.rollCurve(1).drop < 1e-9)
})

test('patrol formation stays within the plateia and ranks keep spacing on straights and turns', () => {
  const L = 820, halfStreet = 13.5 / 2
  const loop = route.cartLoopLength(L)
  for (let lead = 0; lead < loop; lead += 0.73) {
    for (const file of [-1, 1]) {
      const a = route.patrolPose(lead, 0, file, L), b = route.patrolPose(lead, 1, file, L)
      for (const p of [a, b]) {
        assert.ok(Math.abs(p.v) <= 2.4 + 0.7 + 1e-9 && Math.abs(p.v) <= halfStreet, `v=${p.v}`)
        assert.ok(p.u > 30 - 2.4 - 0.71 && p.u < L - 30 + 2.4 + 0.71)
      }
      const gap = Math.hypot(a.u - b.u, a.v - b.v)
      assert.ok(gap > 1.05 && gap < 1.7 + 0.71, `rank gap ${gap} at ${lead}`)
    }
    const l = route.patrolPose(lead, 0, -1, L), r = route.patrolPose(lead, 0, 1, L)
    assert.ok(Math.abs(Math.hypot(l.u - r.u, l.v - r.v) - 1.4) < 1e-9, 'files 1.4 m apart')
  }
  // on a straight the rank gap is exactly 1.7 m
  const a = route.patrolPose(100, 0, 1, L), b = route.patrolPose(100, 1, 1, L)
  assert.ok(Math.abs(Math.hypot(a.u - b.u, a.v - b.v) - 1.7) < 1e-9)
})

test('patrol marches at 1.6 m/s, halts at each end before turning, and holds when blocked', () => {
  const L = 300, straight = L - 60
  const s = { lead: straight - 1, halt: 0 }
  assert.equal(route.advancePatrol(s, 0.5, L), true)
  assert.ok(Math.abs(s.lead - (straight - 0.2)) < 1e-9)
  assert.equal(route.advancePatrol(s, 0.5, L), false)
  assert.ok(Math.abs(s.lead - straight) < 1e-9)
  assert.equal(s.halt, route.PATROL.halt)
  let t = 0
  while (!route.advancePatrol(s, 0.1, L)) t += 0.1
  assert.ok(t >= route.PATROL.halt - 0.11 && t <= route.PATROL.halt + 0.11)
  assert.ok(s.lead > straight)
  const held = { lead: 50, halt: 0 }
  assert.equal(route.advancePatrol(held, 1, L, true), false)
  assert.equal(held.lead, 50)
})
