import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'

export function Loader() {
  const t = useT()
  const { active, progress } = useProgress()
  const [gone, setGone] = useState(false)
  useEffect(() => { if (!active && progress === 100) { const id = setTimeout(() => setGone(true), 600); return () => clearTimeout(id) } }, [active, progress])
  if (gone) return null
  const done = !active && progress === 100
  return (
    <div className={'absolute inset-0 z-50 grid place-items-center bg-[#16100b] transition-opacity duration-700 ' + (done ? 'pointer-events-none opacity-0' : 'opacity-100')}>
      <div className="text-center">
        <p className="font-display text-3xl tracking-[0.3em] text-travertine">HIERAPOLIS</p>
        <div className="mx-auto mt-6 h-px w-56 bg-white/10"><div className="h-px bg-gold transition-all" style={{ width: `${progress}%` }} /></div>
        <p className="mt-4 font-serif italic text-travertine/60">{t('loading')}</p>
      </div>
    </div>
  )
}
