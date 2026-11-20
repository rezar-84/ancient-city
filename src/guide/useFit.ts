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

const ISO: Record<string, [number, number]> = { a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841] }

/**
 * Paper size for the browser's print / Save as PDF. Sizes are written out in millimetres: CSS only
 * names A3–A5, so a keyword like "A2" is silently ignored and the browser falls back to its default
 * paper (Letter/A4 portrait), whatever orientation was chosen. Each printable route sets its
 * own (there is deliberately no global @page rule, which would override it), and the dialog then
 * uses this size and orientation instead of offering its own.
 */
export function usePrintPage(paper: 'a4' | 'a3' | 'a2' | 'a1', orient: 'portrait' | 'landscape' = 'portrait') {
  const [w, h] = ISO[paper]
  const size = orient === 'portrait' ? `${w}mm ${h}mm` : `${h}mm ${w}mm`
  useEffect(() => {
    const st = document.createElement('style')
    st.dataset.printPage = size
    st.textContent = `@page { size: ${size}; margin: 0; }`
    document.head.appendChild(st)
    document.body.classList.add('printing')
    return () => { st.remove(); document.body.classList.remove('printing') }
  }, [size])
}
