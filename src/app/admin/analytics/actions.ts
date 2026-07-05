'use server'

/**
 * GA4-fed dashboard analytics. Admin-only. Cached via Next's data cache
 * (1h) so the GA4 round-trip is shared across serverless instances and
 * survives cold starts — the dashboard is a signal page, not a live
 * monitor, and GA4 data itself lags hours anyway.
 */
import { unstable_cache } from 'next/cache'

import { requireAdminAction } from '@/lib/authUtils'
import { fetchGa4Snapshot, isGa4Configured } from '@/lib/analytics/ga4'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

export type DashboardAnalytics = {
  topArtworks: {
    slug: string
    title: string
    artistName: string
    /** Print-enabled AND priced — i.e. actually purchasable as a print. */
    sellsPrints: boolean
    views: number
  }[]
  countries: { country: string; sessions: number }[]
  channels: { channel: string; sessions: number }[]
  /** ISO timestamp of the underlying GA4 fetch — rendered as "Updated …". */
  fetchedAt: string
}

export type AnalyticsResult =
  | { ok: true; data: DashboardAnalytics }
  | { ok: false; error: string; notConfigured?: boolean }

const CACHE_SECONDS = 60 * 60
const TOP_ARTWORKS_SHOWN = 8

async function fetchAndEnrich(): Promise<DashboardAnalytics> {
  const snapshot = await fetchGa4Snapshot()

  // Enrich GA's slugs with title / artist / purchasability. Slugs GA saw
  // but the DB no longer has (renamed/deleted artworks) are dropped.
  const slugs = snapshot.topArtworks.map((a) => a.slug)
  const artworks = await prisma.artwork.findMany({
    where: { slug: { in: slugs } },
    select: {
      slug: true,
      title: true,
      name: true,
      printEnabled: true,
      printPriceCents: true,
      user: { select: { name: true, lastName: true } },
    },
  })
  const bySlug = new Map(artworks.map((a) => [a.slug, a]))

  const topArtworks: DashboardAnalytics['topArtworks'] = []
  for (const row of snapshot.topArtworks) {
    const artwork = bySlug.get(row.slug)
    if (!artwork) continue
    topArtworks.push({
      slug: row.slug,
      title: artwork.title || artwork.name,
      artistName: [artwork.user.name, artwork.user.lastName].filter(Boolean).join(' ').trim(),
      sellsPrints: !!artwork.printEnabled && !!artwork.printPriceCents,
      views: row.views,
    })
    if (topArtworks.length >= TOP_ARTWORKS_SHOWN) break
  }

  return {
    topArtworks,
    countries: snapshot.countries,
    channels: snapshot.channels,
    fetchedAt: new Date().toISOString(),
  }
}

// Next data cache: shared across serverless instances (unlike a module-level
// variable, which is per-lambda and mostly cold on an admin-traffic app).
// Errors are not cached — a failed GA4 call is retried on the next request.
const getCachedAnalytics = unstable_cache(fetchAndEnrich, ['dashboard-analytics'], {
  revalidate: CACHE_SECONDS,
})

export async function getDashboardAnalytics(): Promise<AnalyticsResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }

  if (!isGa4Configured()) {
    return { ok: false, notConfigured: true, error: 'GA4 is not configured for this environment.' }
  }

  try {
    return { ok: true, data: await getCachedAnalytics() }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'dashboard-analytics', level: 'warning' })
    return { ok: false, error: 'Could not load analytics from GA4.' }
  }
}
