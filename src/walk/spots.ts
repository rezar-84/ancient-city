import type { Terrain } from '../scene/terrainData'
import { GRID } from '../content/grid'

/** Shared grid frame (u along the plateia from the Frontinus Gate, v across) + named gathering spots,
 *  so the crowd and the street props agree on where things are. */
export function gridFrame(t: Terrain) {
  const [ax, az] = t.toLocal(...GRID.axisFrom), [bx, bz] = t.toLocal(...GRID.axisTo)
  const L = Math.hypot(bx - ax, bz - az)
  const u: [number, number] = [(bx - ax) / L, (bz - az) / L]
  const v: [number, number] = [u[1], -u[0]]
  const P = (pu: number, pv: number): [number, number] => [ax + u[0] * pu + v[0] * pv, az + u[1] * pu + v[1] * pv]
  return { L, u, v, P, yawU: Math.atan2(u[0], u[1]), yawV: Math.atan2(v[0], v[1]) }
}

/** market stalls in the porticoes of the main street (pu, side) — merchants stand behind them */
export function stallSpots(L: number) {
  const out: Array<{ u: number; side: 1 | -1; variant: 0 | 1 | 2 }> = []
  let i = 0
  for (let u = 60; u < L - 60; u += 23 + ((i * 37) % 17)) {
    out.push({ u, side: i % 2 ? 1 : -1, variant: (i % 3) as 0 | 1 | 2 })
    i++
  }
  return out
}
