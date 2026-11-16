import { LANDMARKS } from './content/landmarks'
import { loadTerrain } from './scene/terrainData'
import { focusLandmark } from './scene/Pins'
import { PlaceAudio } from './audio/PlaceAudio'
import { CharacterSelect } from './walk/CharacterSelect'
import { WalkHUD } from './walk/WalkHUD'
import { FastTravel } from './walk/FastTravel'
import { WalkBarks } from './walk/WalkBarks'
import { NavControls } from './ui/NavControls'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Experience } from './scene/Experience'
import { Intro } from './ui/Intro'
import { TopBar } from './ui/TopBar'
import { LandmarkPanel } from './ui/LandmarkPanel'
import { PlanOverlay } from './ui/PlanOverlay'
import { TodayStatus } from './ui/TodayStatus'
import { TourOverlay } from './modes/Tour'
import { Loader } from './ui/Loader'
import { Viewpoints } from './ui/Viewpoints'
import { useApp } from './store'
import { useT } from './i18n'

const PrintGuide = lazy(() => import('./guide/PrintGuide'))
const ARViewer = lazy(() => import('./ar/ARViewer'))
const Posters = lazy(() => import('./guide/Posters'))

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

function Hint() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const selected = useApp((s) => s.selected)
  if (mode !== 'explore' || selected) return null
  return <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-xs text-white/70 backdrop-blur sm:block">{t('hint')}</p>
}

function Keys() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const s = useApp.getState()
      if (e.key === 'Escape' && s.mode !== 'walk') { if (s.arOpen) s.setAR(false); else s.select(null) }
      if (e.key === 'p' && e.shiftKey) s.togglePerf()
      if (e.key === 'l') s.setLang(s.lang === 'en' ? 'tr' : 'en')
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  return null
}

export default function App() {
  const hash = useHashRoute()
  const lang = useApp((s) => s.lang)
  const arOpen = useApp((s) => s.arOpen)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  useEffect(() => {
    const m = hash.match(/^#\/place\/([\w-]+)/)
    if (!m || !LANDMARKS.some((l) => l.id === m[1])) return
    const id = m[1]
    let cancelled = false
    void loadTerrain().then((t) => {
      if (cancelled) return
      useApp.getState().setMode('explore')
      useApp.getState().select(id)
      window.setTimeout(() => { void focusLandmark(t, id) }, 300)
    })
    return () => { cancelled = true }
  }, [hash])

  if (hash.startsWith('#/guide')) {
    return <Suspense fallback={null}><PrintGuide /></Suspense>
  }
  if (hash.startsWith('#/poster')) {
    return <Suspense fallback={null}><Posters /></Suspense>
  }
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 35%, #4a3a2a 0%, #241a12 55%, #120d08 100%)' }}>
      <Experience />
      <Intro />
      <TopBar />
      <PlanOverlay />
      <TodayStatus />
      <LandmarkPanel />
      <TourOverlay />
      <Viewpoints />
      <NavControls />
      <PlaceAudio />
      <WalkHUD />
      <FastTravel />
      <WalkBarks />
      <CharacterSelect />
      <Hint />
      <Loader />
      <Keys />
      {arOpen && <Suspense fallback={null}><ARViewer /></Suspense>}
    </div>
  )
}
