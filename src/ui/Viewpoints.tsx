import { useApp } from '../store'
import { VIEWPOINTS } from '../content/viewpoints'
import { getTerrain } from '../scene/terrainData'
import { flyTo, orbitPose } from '../scene/camera'

export function goToViewpoint(id: string, duration = 3) {
  const v = VIEWPOINTS.find((x) => x.id === id), t = getTerrain()
  if (!v || !t) return
  const [x, z] = t.toLocal(v.at[0], v.at[1])
  const target: [number, number, number] = [x, t.heightAt(x, z) + (v.lift ?? 0), z]
  void flyTo(orbitPose(target, v.bearing, v.elev, v.dist), target, duration)
}

/** Strip of camera presets (explore mode). */
export function Viewpoints() {
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const selected = useApp((s) => s.selected)
  if (mode !== 'explore' || selected) return null
  return (
    <div className="no-scrollbar absolute bottom-[calc(max(0.625rem,env(safe-area-inset-bottom))+64px)] left-1/2 z-10 flex max-w-[94vw] -translate-x-1/2 gap-1 overflow-x-auto rounded-full glass p-1 sm:bottom-14">
      {VIEWPOINTS.map((v) => (
        <button key={v.id} className={'btn-ghost whitespace-nowrap text-xs ' + (v.id === 'pamukkale' ? 'text-gold' : '')} onClick={() => goToViewpoint(v.id)}>
          {v.id === 'pamukkale' ? '◐ ' : ''}{v.label[lang]}
        </button>
      ))}
    </div>
  )
}
