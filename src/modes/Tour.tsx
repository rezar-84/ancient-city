import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { useT } from '../i18n'
import { TOUR } from '../content/tour'
import { LANDMARKS } from '../content/landmarks'
import { getTerrain } from '../scene/terrainData'
import { flyTo, orbitPose, rig } from '../scene/camera'
import { duckAmbient } from '../ui/ambient'

/** Narrated, camera-driven tour. Space = pause/play, ←/→ = previous/next, Esc = exit. */
export function TourOverlay() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const index = useApp((s) => s.tourIndex)
  const playing = useApp((s) => s.tourPlaying)
  const audio = useRef<HTMLAudioElement | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [line, setLine] = useState('')
  const active = mode === 'tour'
  const step = TOUR[index]

  // run a step: fly, then narrate, then advance
  useEffect(() => {
    if (!active || !step) return
    let cancelled = false
    const terrain = getTerrain()
    audio.current?.pause()
    window.clearTimeout(timer.current)
    setLine(step.text[lang])
    if (rig.controls) rig.controls.autoRotate = false

    const run = async () => {
      if (terrain) {
        let target: [number, number, number]
        if (step.landmark) {
          const l = LANDMARKS.find((x) => x.id === step.landmark)!
          const [x, z] = terrain.toLocal(l.lat, l.lon)
          target = [x, terrain.heightAt(x, z) + 6, z]
        } else {
          const [x, z] = terrain.toLocal(step.at![0], step.at![1])
          target = [x, terrain.heightAt(x, z), z]
        }
        const v = step.view
        await flyTo(orbitPose(target, v.bearing, v.elev, v.dist), target, step.flight ?? 3.2)
      }
      if (cancelled) return
      if (rig.controls) { rig.controls.autoRotate = true; rig.controls.autoRotateSpeed = step.spin ?? 0.25 }
      const src = step.audio?.[lang]
      const advance = () => {
        if (cancelled) return
        timer.current = window.setTimeout(() => {
          const s = useApp.getState()
          if (s.mode === 'tour' && s.tourPlaying && s.tourIndex < TOUR.length - 1) s.setTour(s.tourIndex + 1)
          else if (s.tourIndex >= TOUR.length - 1) s.setTourPlaying(false)
        }, 1400)
      }
      if (src) {
        const a = new Audio(src)
        audio.current = a
        a.onplay = () => duckAmbient(true)
        a.onended = () => { duckAmbient(false); advance() }
        a.onerror = () => { timer.current = window.setTimeout(advance, step.text[lang].length * 65) }
        if (useApp.getState().tourPlaying) a.play().catch(() => { timer.current = window.setTimeout(advance, step.text[lang].length * 65) })
      } else {
        // no recording yet: read-time fallback (~15 chars/s)
        timer.current = window.setTimeout(advance, Math.max(6000, step.text[lang].length * 65))
      }
    }
    void run()
    return () => { cancelled = true; window.clearTimeout(timer.current); audio.current?.pause(); duckAmbient(false) }
  }, [active, index, lang, step])

  // pause / resume
  useEffect(() => {
    if (!active) return
    if (playing) void audio.current?.play().catch(() => undefined)
    else audio.current?.pause()
    if (rig.controls) rig.controls.autoRotate = playing
  }, [playing, active])

  // keyboard
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent) => {
      const s = useApp.getState()
      if (e.key === ' ') { e.preventDefault(); s.setTourPlaying(!s.tourPlaying) }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') s.setTour(Math.min(TOUR.length - 1, s.tourIndex + 1))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') s.setTour(Math.max(0, s.tourIndex - 1))
      if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active])

  if (!active || !step) return null
  const s = useApp.getState()
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[7vh] bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[34vh] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center sm:px-4 sm:pb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold">{index + 1} / {TOUR.length} · {step.title[lang]}</p>
        <p key={index + lang} className="mt-2 max-w-3xl font-serif text-base leading-relaxed sm:mt-3 sm:text-xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] sm:text-[26px] animate-[fadeIn_.8s_ease]">
          {line}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
          <button className="glass btn-ghost" onClick={() => s.setTour(Math.max(0, index - 1))} disabled={index === 0}>← {t('prev')}</button>
          <button className="btn-gold min-w-[110px] justify-center" onClick={() => s.setTourPlaying(!playing)}>{playing ? '❚❚ ' + t('pause') : '▶ ' + t('play')}</button>
          <button className="glass btn-ghost" onClick={() => s.setTour(Math.min(TOUR.length - 1, index + 1))} disabled={index === TOUR.length - 1}>{t('next')} →</button>
          <button className="glass btn-ghost" onClick={exit}>✕ {t('exitTour')}</button>
        </div>
        <div className="mt-4 flex gap-1.5">
          {TOUR.map((_, i) => (
            <button key={i} onClick={() => s.setTour(i)} className={'h-1.5 rounded-full transition-all ' + (i === index ? 'w-8 bg-gold' : i < index ? 'w-3 bg-white/70' : 'w-3 bg-white/25')} aria-label={`step ${i + 1}`} />
          ))}
        </div>
      </div>
    </>
  )
}

function exit() {
  const s = useApp.getState()
  s.setTourPlaying(false)
  if (rig.controls) rig.controls.autoRotate = false
  s.setMode('explore')
}
