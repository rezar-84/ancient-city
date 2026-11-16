import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode } from 'postprocessing'
import { N8AOPostPass } from 'n8ao'
import { capturePipeline } from './captureRenders'

/** High tier only: half-res N8AO (contact shadows in corners, colonnades, between houses) + SMAA + ACES.
 * Takes over rendering while mounted (useFrame priority 1); unmount to fall back to the plain MSAA canvas. */
export default function PostFX() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 })
    c.addPass(new RenderPass(scene, camera))
    const ao = new N8AOPostPass(scene, camera, 1, 1)
    ao.setQualityMode('Performance')
    Object.assign(ao.configuration, { aoRadius: 2, distanceFalloff: 1.2, intensity: 1.25, halfRes: true, depthAwareUpsampling: true, gammaCorrection: false })
    ao.configuration.color = new THREE.Color('#252932')
    c.addPass(ao)
    c.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM }), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })))
    return c
  }, [gl, scene, camera])
  useEffect(() => { composer.setSize(size.width, size.height, false) }, [composer, size, dpr])
  useEffect(() => {
    const previous = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    capturePipeline.render = () => {
      const captureSize = gl.getSize(new THREE.Vector2())
      composer.setSize(captureSize.x, captureSize.y, false)
      composer.render(0)
    }
    return () => {
      capturePipeline.render = null
      gl.toneMapping = previous
      composer.dispose()
    }
  }, [composer, gl])
  const buf = useMemo(() => new THREE.Vector2(), [])
  useFrame((_, dt) => {
    // keep the composer's buffers in step with the canvas (AdaptiveDpr / PerformanceMonitor change the pixel ratio)
    if (capturePipeline.busy) return
    gl.getDrawingBufferSize(buf)
    if (composer.inputBuffer.width !== buf.x || composer.inputBuffer.height !== buf.y) composer.setSize(size.width, size.height, false)
    composer.render(dt)
  }, 1)
  return null
}
