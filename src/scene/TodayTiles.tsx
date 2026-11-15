import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GoogleTilesRenderer } from '3d-tiles-renderer'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { useApp } from '../store'

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined
/** EGM96 geoid undulation near Pamukkale (m): Google tiles use ellipsoidal heights, our DEM uses geoid heights. */
const GEOID_N = 36

export const hasTodayTiles = !!KEY

/** Google Photorealistic 3D Tiles of the site as it is today, aligned to the local frame. */
export function TodayTiles({ terrain }: { terrain: Terrain }) {
  const { camera, gl } = useThree()
  const tiles = useMemo(() => {
    if (!KEY) return null
    const t = new GoogleTilesRenderer(KEY)
    t.setLatLonToYUp(THREE.MathUtils.degToRad(terrain.meta.lat0), THREE.MathUtils.degToRad(terrain.meta.lon0))
    t.errorTarget = 6
    t.lruCache.minSize = 600
    t.lruCache.maxSize = 1400
    return t
  }, [terrain])

  useEffect(() => {
    if (!tiles) { useApp.getState().setTiles('error'); return }
    useApp.getState().setTiles('loading')
    let loaded = 0
    const onModel = () => { if (++loaded > 25) useApp.getState().setTiles('ready') }
    // the renderer has no error event: treat "nothing loaded after 10 s" as failure (offline / bad key)
    const timer = window.setTimeout(() => { if (loaded === 0) useApp.getState().setTiles('error') }, 10000)
    tiles.addEventListener('load-model', onModel)
    tiles.setCamera(camera)
    tiles.setResolutionFromRenderer(camera, gl)
    return () => {
      window.clearTimeout(timer)
      tiles.removeEventListener('load-model', onModel)
      tiles.dispose()
      useApp.getState().setTiles('off')
    }
  }, [tiles, camera, gl])

  useFrame(() => {
    if (!tiles) return
    camera.updateMatrixWorld()
    tiles.setResolutionFromRenderer(camera, gl)
    tiles.update()
  })

  if (!tiles) return null
  // Google frame after setLatLonToYUp: +X north, +Z east  ->  ours: +X east, -Z north (rotate +90° about Y)
  return (
    <group rotation-y={Math.PI / 2} position-y={-(terrain.meta.minH + GEOID_N)}>
      <primitive object={tiles.group} />
    </group>
  )
}
