export interface CartPose { u: number; v: number; heading: number }

/** Two street lanes joined by semicircular turns. Distances and coordinates are metres.
 * Pass `out` to reuse a pose object in per-frame loops; otherwise a new one is returned. */
export function cartPose(distance: number, streetLength: number, out: CartPose = { u: 0, v: 0, heading: 0 }): CartPose {
  const radius = 2.4
  const start = 30
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
