import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GoogleTilesRenderer } from '3d-tiles-renderer'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { useApp } from '../store'
import { KEY, registerTodayAttribution } from './todayKey'

/** EGM96 geoid undulation near Pamukkale (m): Google tiles use ellipsoidal heights, our DEM uses geoid heights. */
const GEOID_N = 36

/**
 * One renderer for the whole page visit. Recreating it on every Ancient/Today toggle would start a new
 * Map Tiles API session (a billable root-tileset request) and throw away the tile LRU cache.
 * Google's Map Tiles policies forbid storing tile content beyond normal HTTP caching, so tiles are never
 * persisted by us (the service worker ignores cross-origin requests); the browser HTTP cache honours
 * Google's own headers.
 */
let shared: { tiles: GoogleTilesRenderer; terrain: Terrain; loaded: number } | null = null

function getTiles(terrain: Terrain) {
  if (!KEY) return null
  if (shared && shared.terrain === terrain) return shared
  shared?.tiles.dispose()
  const t = new GoogleTilesRenderer(KEY)
  t.setLatLonToYUp(THREE.MathUtils.degToRad(terrain.meta.lat0), THREE.MathUtils.degToRad(terrain.meta.lon0))
  t.errorTarget = 6
  t.lruCache.minSize = 900
  t.lruCache.maxSize = 2000
  const s = { tiles: t, terrain, loaded: 0 }
  t.addEventListener('load-model', () => {
    if (++s.loaded > 25 && useApp.getState().tiles === 'loading') useApp.getState().setTiles('ready')
  })
  shared = s
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { shared?.tiles.dispose(); shared = null }, { once: true })
  return s
}

/** Google's required attribution while tiles are visible: logo URL and the dynamic data-provider string. */
function todayAttribution(): { logo: string | null; text: string } {
  if (!shared) return { logo: null, text: '' }
  const list = shared.tiles.getAttributions() as { type: string; value: string }[]
  return {
    logo: list.find((a) => a.type === 'image')?.value ?? null,
    text: list.filter((a) => a.type === 'string').map((a) => a.value).join(' '),
  }
}

registerTodayAttribution(todayAttribution)

/** Google Photorealistic 3D Tiles of the site as it is today, aligned to the local frame. Mounted once the
 *  user first switches to Today, then kept alive (hidden, not updated) while the ancient city is shown. */
export default function TodayTiles({ terrain, active }: { terrain: Terrain; active: boolean }) {
  const { camera, gl } = useThree()
  const s = getTiles(terrain)

  useEffect(() => {
    if (!s) { if (active) useApp.getState().setTiles('error'); return }
    if (!active) { useApp.getState().setTiles('off'); return }
    useApp.getState().setTiles(s.loaded > 25 ? 'ready' : 'loading')
    s.tiles.setCamera(camera)
    s.tiles.setResolutionFromRenderer(camera, gl)
    // the renderer has no error event: treat "nothing loaded after 10 s" as failure (offline / bad key)
    const timer = window.setTimeout(() => { if (s.loaded === 0) useApp.getState().setTiles('error') }, 10000)
    return () => window.clearTimeout(timer)
  }, [s, active, camera, gl])

  useFrame(() => {
    if (!s || !active) return
    camera.updateMatrixWorld()
    s.tiles.setResolutionFromRenderer(camera, gl)
    s.tiles.update()
  })

  if (!s) return null
  // Google frame after setLatLonToYUp: +X north, +Z east  ->  ours: +X east, -Z north (rotate +90° about Y)
  return (
    <group rotation-y={Math.PI / 2} position-y={-(terrain.meta.minH + GEOID_N)} visible={active}>
      <primitive object={s.tiles.group} />
    </group>
  )
}
