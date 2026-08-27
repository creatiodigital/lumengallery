'use client'

import { useRouter } from 'next/navigation'

import { setPrintReturnUrl } from '@/components/checkout/printReturnUrl'

/**
 * The one hop into the print wizard.
 *
 * The artwork page is the single door to checkout, and it now has two buttons
 * that open it — the card above the fold and the band below. Both go through
 * here so the return-URL bookkeeping cannot be remembered in one and forgotten
 * in the other.
 *
 * The return URL is recorded from the CURRENT path, not the artwork's canonical
 * one, so closing the wizard sends a visitor back to the exhibition they came
 * from rather than somewhere they have never been.
 */
export function usePrintWizard(slug: string): () => void {
  const router = useRouter()
  return () => {
    setPrintReturnUrl(slug, window.location.pathname)
    router.push(`/artworks/${slug}/print`)
  }
}
