import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useApp } from '../store'
import { useT } from '../i18n'
import { flyTo, orbitPose, rig } from '../scene/camera'
import { getTerrain } from '../scene/terrainData'

function zoom(f: number) {
  const ctl = rig.controls, cam = rig.camera
  if (!ctl || !cam) return
  const off = cam.position.clone().sub(ctl.target)
  off.setLength(THREE.MathUtils.clamp(off.length() * f, ctl.minDistance, ctl.maxDistance))
  void flyTo(ctl.target.clone().add(off).toArray(), ctl.target.toArray(), 0.6, false)
}

function faceNorth() {
  const ctl = rig.controls, cam = rig.camera
  if (!ctl || !cam) return
  const off = cam.position.clone().sub(ctl.target)
  const plan = useApp.getState().mode === 'plan'
  const r = Math.hypot(off.x, off.z)
  const to = plan
    ? new THREE.Vector3(0, off.length(), 1) // straight down, north up
    : new THREE.Vector3(0, off.y, r)
  void flyTo(ctl.target.clone().add(to).toArray(), ctl.target.toArray(), 0.9, false)
}

export function resetView() {
  const t = getTerrain()
  if (!t) return
  const [cx, cz] = t.toLocal(37.9282, 29.1258)
  const cy = t.heightAt(cx, cz)
  if (useApp.getState().mode === 'plan') void flyTo([cx, cy + 1900, cz + 1], [cx, cy, cz], 1.6)
  else void flyTo(orbitPose([cx, cy, cz], 235, 32, 1350), [cx, cy, cz], 1.8)
}

/** Compass (click = face north), zoom and reset buttons. */
export function NavControls() {
  const t = useT()
  const mode = useApp((s) => s.mode)
  const selected = useApp((s) => s.selected)
  const needle = useRef<SVGGElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const ctl = rig.controls
      if (ctl && needle.current) {
        const deg = THREE.MathUtils.radToDeg(ctl.getAzimuthalAngle())
        needle.current.setAttribute('transform', `rotate(${deg.toFixed(1)} 22 22)`)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (mode === 'intro' || mode === 'tour') return null
  const plan = mode === 'plan'
  const pos = plan
    ? 'bottom-36 right-4 sm:right-6' + (selected ? ' sm:right-[452px]' : '')
    : 'bottom-28 right-4 sm:bottom-16' + (selected ? ' hidden sm:flex sm:right-[452px]' : '')
  const btn = 'glass grid h-10 w-10 place-items-center rounded-full text-lg text-travertine/90 hover:text-white'
  return (
    <div className={'absolute z-20 flex flex-col items-center gap-2 ' + pos}>
      <button className={btn + ' h-12 w-12'} onClick={faceNorth} title={t('north')} aria-label={t('north')}>
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
          <g ref={needle}>
            <path d="M22 6 L27 22 L22 19 L17 22 Z" fill="#c9553a" />
            <path d="M22 38 L27 22 L22 25 L17 22 Z" fill="#efe2c4" opacity="0.8" />
            <text x="22" y="5.5" textAnchor="middle" fontSize="7" fill="#efe2c4" fontFamily="serif">N</text>
          </g>
        </svg>
      </button>
      <button className={btn} onClick={() => zoom(0.6)} title={t('zoomIn')} aria-label={t('zoomIn')}>+</button>
      <button className={btn} onClick={() => zoom(1.6)} title={t('zoomOut')} aria-label={t('zoomOut')}>−</button>
      <button className={btn + ' text-base'} onClick={resetView} title={t('resetView')} aria-label={t('resetView')}>⌂</button>
    </div>
  )
}
