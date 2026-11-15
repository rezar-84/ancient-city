import '@google/model-viewer'
import { createElement } from 'react'
import { useApp } from '../store'
import { useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'

/** Bump when public/models is regenerated (scripts/export_models.ts): /models is cached for a week by nginx. */
const MODEL_REV = '2026-11-16'
/** Generated warm afternoon sky (scripts/ar/writers.ts) — bundled, no CDN. */
const ENV_HDR = '/models/env-hierapolis.hdr'
const rev = (url: string) => url + (url.includes('?') ? '&' : '?') + 'v=' + MODEL_REV

/** Full-screen 3D model viewer with "place on your table" AR (WebXR/Scene Viewer on Android, Quick Look on iOS). */
export default function ARViewer() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const selected = useApp((s) => s.selected)
  const l = LANDMARKS.find((x) => x.id === selected && x.model) ?? LANDMARKS.find((x) => x.model)
  if (!l?.model) return null
  const close = () => useApp.getState().setAR(false)
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#16100b]/95 backdrop-blur">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-gold">AR · 3D</p>
          <h2 className="font-display text-xl">{l.name[lang]}</h2>
        </div>
        <button className="btn-ghost text-lg" onClick={close} aria-label={t('close')}>✕</button>
      </div>
      <div className="relative min-h-0 flex-1">
        {createElement('model-viewer', {
          src: rev(l.model.glb),
          'ios-src': l.model.usdz ? rev(l.model.usdz) : undefined,
          ar: true,
          'ar-modes': 'webxr scene-viewer quick-look',
          'ar-scale': 'auto', // model is baked at 1:150 (~0.72 m wide) so it sits on a table; pinch to resize
          'ar-placement': 'floor',
          'quick-look-browsers': 'safari chrome',
          'camera-controls': true,
          'auto-rotate': true,
          'camera-orbit': '180deg 62deg auto',
          'min-camera-orbit': 'auto 15deg auto',
          'max-camera-orbit': 'auto 88deg auto', // never dip under the display plinth
          'shadow-intensity': '1',
          'shadow-softness': '0.85',
          'tone-mapping': 'neutral',
          exposure: '1',
          'environment-image': ENV_HDR,
          alt: l.name[lang],
          style: { width: '100%', height: '100%', background: 'transparent' },
        },
          createElement('button', { slot: 'ar-button', className: 'btn-gold absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 text-base' }, '◈ ' + t('ar')),
        )}
      </div>
      <p className="p-3 text-center text-[11px] text-travertine/50">{l.model.credit}</p>
    </div>
  )
}
