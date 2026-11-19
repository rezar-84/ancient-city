/** Pure walk-move maths shared by WalkControls and the regression tests (no three.js, no DOM). */

/** normal jump take-off speed (m/s) */
export const JUMP_V = 5.4
/** long jump: take-off speed, run-up threshold, carried horizontal speed and air control */
export const LONG_JUMP = { vy: 6.2, minSpeed: 4, carry: 1.3, maxSpeed: 9.5, airControl: 0.25 } as const
/** roll: duration, dash start floor and end speed (m/s), cooldown between roll starts */
export const ROLL = { duration: 0.6, minSpeed: 5.5, endSpeed: 2, cooldown: 0.9 } as const
export const ROLL_MS = ROLL.duration * 1000

export type Gait = 'walk' | 'run' | 'sprint'

export interface JumpLaunch { vy: number; vx: number; vz: number; long: boolean }

/** Take-off: a long jump when running or sprinting faster than 4 m/s, otherwise the normal jump (velocity untouched). */
export function jumpLaunch(gait: Gait, vx: number, vz: number, groundSpeed: number): JumpLaunch {
  const hs = Math.hypot(vx, vz)
  if (gait === 'walk' || groundSpeed <= LONG_JUMP.minSpeed || hs < 1e-3) return { vy: JUMP_V, vx, vz, long: false }
  const carry = Math.min(LONG_JUMP.maxSpeed, Math.max(hs, groundSpeed) * LONG_JUMP.carry)
  return { vy: LONG_JUMP.vy, vx: (vx / hs) * carry, vz: (vz / hs) * carry, long: true }
}

/** Desired airborne velocity during a long jump: the locked take-off velocity, steered by only 25% of the input. */
export function longJumpSteer(lockX: number, lockZ: number, wantX: number, wantZ: number): [number, number] {
  const k = LONG_JUMP.airControl
  return [lockX + (wantX - lockX) * k, lockZ + (wantZ - lockZ) * k]
}

/** Roll dash speed at progress 0..1: from max(entry, 5.5) easing out to 2 m/s. */
export function rollSpeed(progress: number, entrySpeed: number) {
  const p = Math.min(1, Math.max(0, progress))
  const v0 = Math.max(entrySpeed, ROLL.minSpeed)
  const ease = 1 - (1 - p) * (1 - p)
  return v0 + (ROLL.endSpeed - v0) * ease
}

/** Visual roll curve for a progress 0..1: pitch angle (rad, forward) and hip drop (m). */
export function rollCurve(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  const s = p * p * p * (p * (p * 6 - 15) + 10) // smootherstep
  return { angle: s * Math.PI * 2, drop: Math.sin(p * Math.PI) }
}

/** Axis-separated slide used by the walker after wall projection: full move, then x only, then z only. */
export function slideMove(x: number, z: number, mx: number, mz: number, ok: (x: number, z: number) => boolean): { x: number; z: number; blocked: boolean } {
  if (ok(x + mx, z + mz)) return { x: x + mx, z: z + mz, blocked: false }
  if (ok(x + mx, z)) return { x: x + mx, z, blocked: false }
  if (ok(x, z + mz)) return { x, z: z + mz, blocked: false }
  return { x, z, blocked: true }
}
