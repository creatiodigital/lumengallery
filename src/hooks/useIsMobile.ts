'use client'

import { useEffect, useState } from 'react'

/**
 * Mirror of `$breakpoints.tablet` in src/styles/mixins.scss — JS can't read
 * SCSS tokens, so consumers that must match `media-down(tablet)` use this
 * constant (pass `TABLET_BREAKPOINT_PX + 1`, since media-down's max-width is
 * inclusive while useIsMobile's `<` is exclusive). Keep the two in sync.
 */
export const TABLET_BREAKPOINT_PX = 900

/** True when the viewport is narrower than `breakpoint` (default 1024px). SSR-safe. */
export const useIsMobile = (breakpoint = 1024): boolean => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
