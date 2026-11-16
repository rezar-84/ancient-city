/** Phones/tablets and small screens get the light tier: 2k shadows, no post-processing, fewer lights. */
export const isLight = typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 700)
