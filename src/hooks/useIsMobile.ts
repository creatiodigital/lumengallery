'use client'

import { useEffect, useState } from 'react'

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
