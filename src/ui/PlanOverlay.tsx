import { useApp } from '../store'
import { formatYear, useT } from '../i18n'
import { LANDMARKS } from '../content/landmarks'
import { lname } from '../content/types'
import { ERAS, TIMELINE } from '../content/timeline'
import { HISTORIC_MAPS } from '../content/images'
import { Lightbox } from './LandmarkPanel'
import { useState } from 'react'
import { GRID } from '../content/grid'

const MIN = -200, MAX = 1400

export function PlanOverlay() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const mode = useApp((s) => s.mode)
  const year = useApp((s) => s.year)
  const selected = useApp((s) => s.selected)
  const showGrid = useApp((s) => s.showGrid)
  const [maps, setMaps] = useState(false)
  if (mode !== 'plan') return null
  const era = ERAS.find((e) => year >= e.from && year < e.to)
  const nearest = TIMELINE.reduce((a, b) => (Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a), TIMELINE[0])

  return (
    <>
      {/* legend */}
      <div className="glass scroll-thin absolute left-4 top-20 z-10 hidden max-h-[calc(100vh-220px)] w-64 overflow-y-auto rounded-2xl bg-parchment/95 p-4 text-ink md:block">
        <h3 className="font-display text-sm tracking-[0.2em] text-terracotta">{t('legend').toUpperCase()}</h3>
        <ol className="mt-2 space-y-0.5 font-serif text-[15px]">
          {LANDMARKS.map((l, i) => {
            const exists = year >= l.built && (l.until === undefined || year <= l.until)
            return (
              <li key={l.id}>
                <button
                  className={'flex w-full gap-2 rounded px-1.5 py-0.5 text-left hover:bg-ink/10 ' + (selected === l.id ? 'bg-ink/10' : '') + (exists ? '' : ' opacity-40')}
                  onClick={() => useApp.getState().select(l.id)}
                >
                  <span className="w-5 shrink-0 text-right font-display text-terracotta">{i + 1}</span>
                  <span>{lname(l, lang)}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 border-t border-ink/20 pt-2 text-[11px] leading-snug text-ink/60">{t('planNote')}</p>
        {showGrid && <p className="mt-2 text-[11px] leading-snug text-ink/60">{GRID.note[lang]}</p>}
        <p className="mt-2 text-[11px] leading-snug text-ink/50">{t('planHint')}</p>
      </div>

      {HISTORIC_MAPS.length > 0 && (
        <button className="glass btn-ghost absolute left-4 top-20 z-10 md:left-72" onClick={() => setMaps(true)}>🗺 {t('historicMaps')} · {HISTORIC_MAPS.length}</button>
      )}
      {maps && <Lightbox items={HISTORIC_MAPS} index={0} onClose={() => setMaps(false)} />}

      {/* timeline */}
      <div className={'glass absolute inset-x-3 bottom-3 z-10 mx-auto max-w-4xl rounded-2xl px-5 py-3 sm:bottom-5 ' + (selected ? 'sm:left-6 sm:right-[460px]' : 'sm:inset-x-6')}>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <span className="font-display text-2xl text-gold">{formatYear(year, lang)}</span>
            {era && <span className="ml-3 text-xs uppercase tracking-[0.2em] text-travertine/60">{era.label[lang]}</span>}
          </div>
          <p className="hidden max-w-md truncate text-right font-serif text-sm italic text-travertine/80 sm:block">
            {formatYear(nearest.year, lang)} · {nearest.label[lang]}
          </p>
        </div>
        <div className="relative mt-2">
          <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 overflow-hidden rounded-full">
            {ERAS.map((e) => (
              <div key={e.id} style={{ flex: Math.min(e.to, MAX) - Math.max(e.from, MIN), background: e.color }} title={e.label[lang]} />
            ))}
          </div>
          <input
            type="range" min={MIN} max={MAX} step={10} value={year}
            onChange={(e) => useApp.getState().setYear(Number(e.target.value))}
            className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent accent-[#c9a45c]"
            aria-label={t('year')}
          />
          {TIMELINE.filter((e) => e.year >= MIN && e.year <= MAX).map((e) => (
            <button
              key={e.year + e.label.en}
              className="absolute top-1/2 z-20 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-travertine/80 hover:bg-white"
              style={{ left: `${((e.year - MIN) / (MAX - MIN)) * 100}%` }}
              onClick={() => useApp.getState().setYear(e.year)}
              title={`${formatYear(e.year, lang)} — ${e.label[lang]}`}
            />
          ))}
        </div>
      </div>
    </>
  )
}
