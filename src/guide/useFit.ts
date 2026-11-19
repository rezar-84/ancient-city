import { useEffect, useState } from 'react'

const MM = 96 / 25.4 // CSS px per mm

/**
 * Screen-preview scale for a printed sheet `widthMM` wide, so A4–A2 pages fit a phone without
 * sideways scrolling. Applied as the `--fit` CSS variable (zoom); print always uses 1:1.
 */
export function useFit(widthMM: number, zoomed = false, gutterPx = 12) {
  const [fit, setFit] = useState(1)
  useEffect(() => {
    const on = () => {
      const f = Math.min(1, (document.documentElement.clientWidth - gutterPx * 2) / (widthMM * MM))
      // zoomed: at least 2.5× the fitted size (capped at 1:1), panned sideways
      setFit(zoomed ? Math.min(1, f * 2.5) : f)
    }
    on()
    window.addEventListener('resize', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); window.visualViewport?.removeEventListener('resize', on) }
  }, [widthMM, zoomed, gutterPx])
  return fit
}
