export interface CartPose { u: number; v: number; heading: number }

/** Lane offset either side of the street axis, and the turn radius at both ends (m). */
const RADIUS = 2.4
/** Straightaways start/stop this far from either end of the street (m). */
const START = 30

/** Length of the closed cart loop (both lanes plus both semicircular turns) for a street of `streetLength` m. */
export function cartLoopLength(streetLength: number) {
  return 2 * (streetLength - 2 * START + Math.PI * RADIUS)
}

/** Two street lanes joined by semicircular turns. Distances and coordinates are metres.
 * Pass `out` to reuse a pose object in per-frame loops; otherwise a new one is returned. */
export function cartPose(distance: number, streetLength: number, out: CartPose = { u: 0, v: 0, heading: 0 }): CartPose {
  const radius = RADIUS
  const start = START
  const straight = streetLength - 2 * start
  const turn = Math.PI * radius
  const loop = 2 * (straight + turn)
  const s = ((distance % loop) + loop) % loop
  if (s < straight) { out.u = start + s; out.v = radius; out.heading = 0; return out }
  if (s < straight + turn) {
    const angle = (s - straight) / radius
    out.u = start + straight + radius * Math.sin(angle); out.v = radius * Math.cos(angle); out.heading = -angle
    return out
  }
  if (s < 2 * straight + turn) { out.u = start + 2 * straight + turn - s; out.v = -radius; out.heading = -Math.PI; return out }
  const angle = (s - 2 * straight - turn) / radius
  out.u = start - radius * Math.sin(angle); out.v = -radius * Math.cos(angle); out.heading = -Math.PI - angle
  return out
}

/** Marching patrol on the cart loop: 2 files x 2 ranks, 1.7 m between ranks, files 0.7 m either side of the lane. */
export const PATROL = { speed: 1.6, rankGap: 1.7, fileOffset: 0.7, ranks: 2, files: 2, halt: 2.5 } as const

export interface PatrolState {
  /** loop distance of the leading rank (m) */
  lead: number
  /** seconds left in the current halt */
  halt: number
}

/** Advance the squad. It halts for PATROL.halt s at the end of each straight before turning about,
 * and holds while `hold` (something in its path). Returns true while marching. */
export function advancePatrol(state: PatrolState, dt: number, streetLength: number, hold = false): boolean {
  if (state.halt > 0) { state.halt = Math.max(0, state.halt - dt); return false }
  if (hold || dt <= 0) return false
  const straight = streetLength - 2 * START, turn = Math.PI * RADIUS, loop = cartLoopLength(streetLength)
  const before = ((state.lead % loop) + loop) % loop
  const step = PATROL.speed * dt
  for (const stop of [straight, 2 * straight + turn]) {
    // epsilon: a squad resting exactly on the stop (float round-off) must not halt twice
    if (before < stop - 1e-6 && before + step >= stop) {
      state.lead += stop - before
      state.halt = PATROL.halt
      return false
    }
  }
  state.lead += step
  return true
}

/** Street-frame position (u along, v across) and heading of one member. file: -1 / +1 (left / right of the lane). */
export function patrolPose(lead: number, rank: number, file: number, streetLength: number, out: CartPose = { u: 0, v: 0, heading: 0 }): CartPose {
  cartPose(lead - rank * PATROL.rankGap, streetLength, out)
  // travel direction in (u, v) is (cos h, sin h); the files sit on its perpendicular
  out.u += -Math.sin(out.heading) * file * PATROL.fileOffset
  out.v += Math.cos(out.heading) * file * PATROL.fileOffset
  return out
}
