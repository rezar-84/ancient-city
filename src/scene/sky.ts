import * as THREE from 'three'

/**
 * Time of day. `computeSky(hour)` fills the shared SKY state that the lights, sky dome, fog, torches and
 * audio read every frame. The sun runs east (06 h) → south → west (18 h) with a southern tilt for
 * Hierapolis (37.9° N); below the horizon a cool moon takes over the shadow-casting light.
 * Colours are keyed on sun elevation, so dawn and dusk mirror each other.
 */
export interface SkyState {
  hour: number
  /** direction towards the shadow-casting light (sun by day, moon at night), normalised */
  lightDir: THREE.Vector3
  /** direction towards the sun (always), for the sky glow */
  sunDir: THREE.Vector3
  lightColor: THREE.Color
  lightIntensity: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
  zenith: THREE.Color
  haze: THREE.Color
  sunGlow: THREE.Color
  envIntensity: number
  /** 0 by day … 1 at full night */
  night: number
  /** torch strength 0…1 (on from late golden hour) */
  torch: number
  /** steam visibility (cool mornings and evenings show more) */
  steam: number
}

export const SKY: SkyState = {
  hour: 16,
  lightDir: new THREE.Vector3(-0.8, 0.42, 0.41).normalize(),
  sunDir: new THREE.Vector3(-0.8, 0.42, 0.41).normalize(),
  lightColor: new THREE.Color('#ffe2bd'),
  lightIntensity: 2.6,
  hemiSky: new THREE.Color('#c4d8ec'),
  hemiGround: new THREE.Color('#7a5c3e'),
  hemiIntensity: 0.32,
  zenith: new THREE.Color('#4f7fb0'),
  haze: new THREE.Color('#cdc1ad'),
  sunGlow: new THREE.Color('#ffc58a'),
  envIntensity: 0.55,
  night: 0,
  torch: 0,
  steam: 0.3,
}

/** keyframes by sun elevation (y of the unit sun vector) */
interface Key { e: number; light: string; li: number; hs: string; hg: string; hi: number; zen: string; haze: string; glow: string; env: number }
const KEYS: Key[] = [
  { e: -0.35, light: '#8fa8d6', li: 0.32, hs: '#2c3a58', hg: '#15120f', hi: 0.16, zen: '#060c1a', haze: '#141b29', glow: '#2a3550', env: 0.1 },
  { e: -0.08, light: '#8fa8d6', li: 0.22, hs: '#46527a', hg: '#1d1712', hi: 0.18, zen: '#18284a', haze: '#5b4f5c', glow: '#c0624a', env: 0.16 },
  { e: 0.02, light: '#ff8c4a', li: 0.9, hs: '#8794b8', hg: '#4a3526', hi: 0.22, zen: '#36578a', haze: '#e39a6c', glow: '#ff7a3c', env: 0.3 },
  { e: 0.16, light: '#ffb070', li: 2.0, hs: '#aab9d6', hg: '#6a4e36', hi: 0.27, zen: '#45709f', haze: '#dcae86', glow: '#ff9d55', env: 0.45 },
  { e: 0.42, light: '#ffe2bd', li: 2.6, hs: '#c4d8ec', hg: '#7a5c3e', hi: 0.32, zen: '#4f7fb0', haze: '#cdc1ad', glow: '#ffc58a', env: 0.55 },
  { e: 0.9, light: '#fff3e2', li: 3.0, hs: '#cfe0f2', hg: '#83674a', hi: 0.42, zen: '#4d86c4', haze: '#d6d4cb', glow: '#fff0d0', env: 0.68 },
]
const ca = new THREE.Color(), cb = new THREE.Color()
function lerpCol(out: THREE.Color, a: string, b: string, t: number) { ca.set(a); cb.set(b); out.copy(ca).lerp(cb, t) }
const smooth = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

/** sun direction for a local solar hour (pure; also used by tests) */
export function sunDirection(hour: number, out = new THREE.Vector3()) {
  const a = ((hour - 6) / 12) * Math.PI // 0 at sunrise (east), π at sunset (west)
  const s = Math.sin(a)
  return out.set(Math.cos(a), s * 0.92, 0.35 + Math.max(s, 0) * 0.2).normalize()
}

const moon = new THREE.Vector3()
export function computeSky(hour: number, out: SkyState = SKY) {
  out.hour = hour
  sunDirection(hour, out.sunDir)
  const e = out.sunDir.y
  let i = 0
  while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++
  const k0 = KEYS[i], k1 = KEYS[i + 1]
  const t = THREE.MathUtils.clamp((e - k0.e) / (k1.e - k0.e), 0, 1)
  lerpCol(out.lightColor, k0.light, k1.light, t)
  lerpCol(out.hemiSky, k0.hs, k1.hs, t)
  lerpCol(out.hemiGround, k0.hg, k1.hg, t)
  lerpCol(out.zenith, k0.zen, k1.zen, t)
  lerpCol(out.haze, k0.haze, k1.haze, t)
  lerpCol(out.sunGlow, k0.glow, k1.glow, t)
  out.lightIntensity = THREE.MathUtils.lerp(k0.li, k1.li, t)
  out.hemiIntensity = THREE.MathUtils.lerp(k0.hi, k1.hi, t)
  out.envIntensity = THREE.MathUtils.lerp(k0.env, k1.env, t)
  out.night = 1 - smooth(-0.2, 0.02, e)
  out.torch = 1 - smooth(0.02, 0.14, e)
  out.steam = 0.25 + 0.75 * (1 - smooth(0.1, 0.5, e))
  // the shadow light: sun while it is up, the moon (high in the south-east at night) once it has set
  if (e > -0.04) out.lightDir.copy(out.sunDir)
  else out.lightDir.copy(moon.set(0.35, 0.75, 0.45).normalize())
  // keep a low sun from casting kilometre-long shadows through the city
  if (out.lightDir.y < 0.08) { out.lightDir.y = 0.08; out.lightDir.normalize() }
  return out
}

export const PRESETS: Array<{ id: 'morning' | 'noon' | 'golden' | 'dusk' | 'night'; hour: number }> = [
  { id: 'morning', hour: 7.5 },
  { id: 'noon', hour: 12.5 },
  { id: 'golden', hour: 17 },
  { id: 'dusk', hour: 18.6 },
  { id: 'night', hour: 22 },
]

export const formatHour = (h: number) => {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

computeSky(16)
