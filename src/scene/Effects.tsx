import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SKY } from './sky'
import { sceneUniforms } from './Terrain'
import type { Terrain } from './terrainData'
import { LANDMARKS } from '../content/landmarks'
import { useApp } from '../store'

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.5, 'rgba(240,240,235,0.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Low, drifting "breath of Hades" over the Ploutonion arena. */
export function PloutonionMist({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const group = useRef<THREE.Group>(null)
  const { center, puffs, mat } = useMemo(() => {
    const l = LANDMARKS.find((x) => x.id === 'ploutonion')!
    const [x, z] = terrain.toLocal(l.lat, l.lon)
    const mat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: '#e9eef0' })
    const puffs = Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2, r: 4 + Math.random() * 14, s: 8 + Math.random() * 10, ph: Math.random() * 10 }))
    return { center: new THREE.Vector3(x, terrain.heightAt(x, z) + 0.8, z), puffs, mat }
  }, [terrain])
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return
    g.visible = mode !== 'plan' && era === 'ancient'
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const p = puffs[i]
      const a = p.a + t * 0.04
      c.position.set(Math.cos(a) * p.r + Math.sin(t * 0.3 + p.ph) * 2, 0.6 + Math.sin(t * 0.5 + p.ph) * 0.4, Math.sin(a) * p.r)
      ;(c as THREE.Sprite).material.opacity = 0.35 + 0.15 * Math.sin(t * 0.7 + p.ph)
    })
  })
  return (
    <group ref={group} position={center}>
      {puffs.map((p, i) => <sprite key={i} material={mat} scale={[p.s, p.s * 0.45, 1]} />)}
    </group>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Atmosphere: height fog / aerial perspective (global fog chunk), sky dome, and the optional
 * high-quality post chain (half-res N8AO ambient occlusion + SMAA + ACES) for capable GPUs.
 * ---------------------------------------------------------------------------------------------- */

/** Horizon haze: fog colour and the bottom of the sky gradient are the same, so distance melts into sky. */
export const HAZE = new THREE.Color('#cdc1ad')
const GROUND = new THREE.Color('#2a1f16')

// Height fog: linear THREE.Fog drives start/end, density thickens in the valley (low Y) and thins with altitude.
// Patched once, globally, so every built-in material (incl. instanced and sprite materials) gets it.
let fogPatched = false
export function patchFogChunks() {
  if (fogPatched) return
  fogPatched = true
  const C = THREE.ShaderChunk as unknown as Record<string, string>
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogWorldY;\n#endif'
  // world position from the view-space position (view matrix is rigid): w = R^T (mv - t)
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogWorldY = ((mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix)).y;\n#endif'
  C.fog_pars_fragment = `#ifdef USE_FOG
\tuniform vec3 fogColor;
\tvarying float vFogDepth;
\tvarying float vFogWorldY;
\t#ifdef FOG_EXP2
\t\tuniform float fogDensity;
\t#else
\t\tuniform float fogNear;
\t\tuniform float fogFar;
\t#endif
#endif`
  C.fog_fragment = `#ifdef USE_FOG
\t#ifdef FOG_EXP2
\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
\t#else
\t\tfloat fogT = max( vFogDepth - fogNear, 0.0 ) / ( fogFar - fogNear );
\t\tfloat fogH = exp( - max( vFogWorldY - 40.0, 0.0 ) / 240.0 );
\t\tfloat fogFactor = 1.0 - exp( - fogT * ( 0.3 + 1.2 * fogH ) - fogT * fogT * 1.4 );
\t#endif
\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`
}

/** Gradient sky dome that follows the camera: haze at the horizon, blue overhead, a warm glow round the sun,
 * dark earth below. Fades out in plan mode so the parchment map sits on the page background. */
export function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      // live references into the time-of-day state: no per-frame uniform copies
      uZenith: { value: SKY.zenith }, uHaze: { value: SKY.haze }, uGround: { value: GROUND },
      uSun: { value: SKY.sunDir }, uSunCol: { value: SKY.sunGlow },
      uNight: { value: 0 }, uPlan: sceneUniforms.uPlan,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHaze, uGround, uSun, uSunCol;
      uniform float uPlan, uNight;
      varying vec3 vDir;
      float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float e = d.y;
        vec3 sky = mix(uHaze, uZenith, pow(smoothstep(0.0, 0.75, e), 0.7));
        float s = max(dot(d, uSun), 0.0);
        sky += uSunCol * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6) * smoothstep(-0.1, 0.1, e) * smoothstep(-0.25, 0.0, uSun.y);
        if (uNight > 0.01 && e > 0.0) {
          // stars: a sparse hash lattice, twinkle-free so it does not crawl when the camera turns
          vec3 g = floor(d * 260.0);
          float st = step(0.9965, hash3(g)) * smoothstep(0.02, 0.25, e);
          sky += vec3(0.85, 0.9, 1.0) * st * uNight * (0.5 + hash3(g + 7.0));
          // moon disc and halo in the south-east
          vec3 md = normalize(vec3(0.35, 0.75, 0.45));
          float m = max(dot(d, md), 0.0);
          sky += vec3(0.75, 0.82, 0.95) * (smoothstep(0.9993, 0.9996, m) * 1.4 + pow(m, 80.0) * 0.12) * uNight;
        }
        vec3 col = e >= 0.0 ? sky : mix(uHaze, uGround, smoothstep(0.0, 0.18, -e));
        gl_FragColor = vec4(col, 1.0 - uPlan);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
  }), [])
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position)
    mat.uniforms.uNight.value = SKY.night
  })
  return <mesh ref={mesh} material={mat} frustumCulled={false} renderOrder={-10}><sphereGeometry args={[14000, 32, 16]} /></mesh>
}
