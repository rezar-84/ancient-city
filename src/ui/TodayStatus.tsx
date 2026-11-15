import { useApp } from '../store'
import { useT } from '../i18n'

export function TodayStatus() {
  const t = useT()
  const era = useApp((s) => s.era)
  const mode = useApp((s) => s.mode)
  const tiles = useApp((s) => s.tiles)
  if (era !== 'today' || mode === 'plan' || mode === 'intro') return null
  const msg = tiles === 'loading' ? t('todayLoading') : tiles === 'error' ? t('todayFallback') : null
  if (!msg) return null
  return <p className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/80 backdrop-blur">{msg}</p>
}
