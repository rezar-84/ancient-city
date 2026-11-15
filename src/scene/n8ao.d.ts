// Minimal typings for n8ao (ships without .d.ts). Only what PostFX uses.
declare module 'n8ao' {
  import type { Camera, Color, Scene } from 'three'
  import type { Pass } from 'postprocessing'
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number)
    configuration: {
      aoSamples: number; aoRadius: number; denoiseSamples: number; denoiseRadius: number
      distanceFalloff: number; intensity: number; color: Color; halfRes: boolean
      depthAwareUpsampling: boolean; screenSpaceRadius: boolean; gammaCorrection: boolean
      colorMultiply: boolean; accumulate: boolean; renderMode: number
    }
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void
    setSize(width: number, height: number): void
  }
}
