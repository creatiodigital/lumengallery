'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Detects when a tab is running a stale/cached build (old JS/HTML) after a newer
 * deploy, and reports it to Sentry so we can SEE how many users are on outdated
 * versions — a failure mode that's otherwise completely invisible (it doesn't
 * throw; it just causes weird "works on refresh" behaviour). Launch hardening,
 * see project_observability_instrumentation_map.
 *
 * It compares the build the tab booted (`NEXT_PUBLIC_BUILD_ID`, inlined at build
 * time) against the server's live build (`/api/version`), on an interval and
 * whenever the tab regains focus. Reports at most once per tab.
 *
 * Knowing != preventing: the actual safeguard against version skew is Vercel
 * Skew Protection (a dashboard toggle). This is the visibility layer. A future
 * enhancement can surface a "refresh for the latest version" prompt here.
 */
const BOOTED_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
const CHECK_INTERVAL_MS = 5 * 60 * 1000

export const VersionGuard = () => {
  useEffect(() => {
    // No real build to compare against locally — skip entirely.
    if (BOOTED_BUILD === 'dev') return

    let reported = false

    const check = async () => {
      if (reported || document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { build } = (await res.json()) as { build?: string }
        if (!build || build === 'dev' || build === BOOTED_BUILD) return

        reported = true
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('flow', 'version-skew')
          scope.setFingerprint(['stale-client'])
          scope.setExtra('bootedBuild', BOOTED_BUILD)
          scope.setExtra('serverBuild', build)
          Sentry.captureMessage('Stale client: tab is running an outdated build', 'warning')
        })
      } catch {
        // Network blip — ignore and try again next tick.
      }
    }

    const id = window.setInterval(check, CHECK_INTERVAL_MS)
    const onVisible = () => check()
    document.addEventListener('visibilitychange', onVisible)
    // First check shortly after mount, once the page has settled.
    const t = window.setTimeout(check, 10_000)

    return () => {
      window.clearInterval(id)
      window.clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
