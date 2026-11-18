/** Two street lanes joined by semicircular turns. Distances and coordinates are metres. */
export function cartPose(distance: number, streetLength: number) {
  const radius = 2.4
  const start = 30
  const straight = streetLength - 2 * start
  const turn = Math.PI * radius
  const loop = 2 * (straight + turn)
  const s = ((distance % loop) + loop) % loop
  if (s < straight) return { u: start + s, v: radius, heading: 0 }
  if (s < straight + turn) {
    const angle = (s - straight) / radius
    return { u: start + straight + radius * Math.sin(angle), v: radius * Math.cos(angle), heading: -angle }
  }
  if (s < 2 * straight + turn) return { u: start + 2 * straight + turn - s, v: -radius, heading: -Math.PI }
  const angle = (s - 2 * straight - turn) / radius
  return { u: start - radius * Math.sin(angle), v: -radius * Math.cos(angle), heading: -Math.PI - angle }
}
