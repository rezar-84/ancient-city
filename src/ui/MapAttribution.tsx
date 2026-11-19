import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { readTodayAttribution, type TodayAttribution } from '../scene/todayKey'

/** On-screen map-data attribution required by the data providers while their data is visible:
 *  Google (Photorealistic 3D Tiles, dynamic provider string), OpenStreetMap (plan, ODbL), Esri (imagery). */
export function MapAttribution() {
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const tiles = useApp((s) => s.tiles)
  const google = era === 'today' && tiles === 'ready' && mode !== 'plan'
  const [attr, setAttr] = useState<TodayAttribution>({ logo: null, text: '' })

  useEffect(() => {
    if (!google) return
    const tick = () => setAttr((prev) => {
      const next = readTodayAttribution()
      return next.text === prev.text && next.logo === prev.logo ? prev : next
    })
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [google])

  if (mode === 'intro' || mode === 'choose') return null
  const content = mode === 'plan'
    ? <>Plan data © OpenStreetMap contributors (ODbL)</>
    : google
      ? <>{attr.logo ? <img src={attr.logo} alt="Google" className="inline h-3 align-[-2px]" /> : <span className="font-medium">Google</span>}{attr.text ? ` · ${attr.text}` : ''}</>
      : <>Imagery © Esri, Maxar, Earthstar Geographics</>

  return (
    <p className="pointer-events-none absolute bottom-[max(0.25rem,env(safe-area-inset-bottom))] right-[max(0.5rem,env(safe-area-inset-right))] z-10 max-w-[70vw] truncate rounded bg-black/35 px-1.5 py-0.5 text-[10px] leading-tight text-white/75">
      {content}
    </p>
  )
}
