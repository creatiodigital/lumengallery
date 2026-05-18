'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { LoadingBar } from '@/components/ui/LoadingBar'

/**
 * Shows the LoadingBar at the top of the viewport during route
 * navigation, so users get immediate feedback that their click was
 * registered while the SSR'd next page is being fetched.
 *
 * Mechanism: a document-level click listener flips `pending` to true
 * when the user clicks an internal anchor that will trigger a route
 * change. The flag clears once `usePathname()` reflects the new path —
 * which only happens after the new page has rendered, i.e. the moment
 * the destination content is visible.
 *
 * Not covered (out of scope for now): programmatic `router.push()`
 * from buttons (no click on an <a>), and search-param-only navigations
 * that don't change the pathname. Wire those up separately if needed.
 */
// Safety net: if a navigation never completes (e.g. Stripe-hosted
// iframe redirect, server error swallowed somewhere), clear the bar
// after this many ms instead of leaving it stuck. SSR pages on this
// site routinely take ~1s; 10s leaves plenty of headroom.
const MAX_PENDING_MS = 10_000

export function NavigationProgressBar() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  // Pathname committed → navigation done.
  useEffect(() => {
    setPending(false)
  }, [pathname])

  // Fallback clear in case pathname never changes (broken nav, prevented
  // click on something that looked like a real link, etc.).
  useEffect(() => {
    if (!pending) return
    const t = window.setTimeout(() => setPending(false), MAX_PENDING_MS)
    return () => window.clearTimeout(t)
  }, [pending])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Don't gate on `e.defaultPrevented`: Next's <Link> intentionally
      // calls preventDefault to take over navigation client-side, and
      // those are exactly the clicks we want to react to.

      // Left-click only; ignore middle/right.
      if (e.button !== 0) return
      // Modifier keys = "open in new tab/window/etc." — no in-page nav.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      // Walk up to the nearest anchor (clicks often land on inner spans/svgs).
      let node: HTMLElement | null = e.target as HTMLElement | null
      while (node && node.tagName !== 'A') node = node.parentElement
      if (!node) return

      const a = node as HTMLAnchorElement
      if (!a.href) return
      if (a.target && a.target !== '_self') return
      if (a.hasAttribute('download')) return

      let url: URL
      try {
        url = new URL(a.href)
      } catch {
        return
      }

      // Different origin: full page load, browser handles the chrome.
      if (url.origin !== window.location.origin) return

      // Same URL (or pure hash change on the same page): no navigation.
      const samePath = url.pathname === window.location.pathname
      const sameSearch = url.search === window.location.search
      if (samePath && sameSearch) return

      setPending(true)
    }

    // Capture phase so we still see the click if a downstream handler
    // calls stopPropagation in bubble.
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  if (!pending) return null
  return <LoadingBar />
}
