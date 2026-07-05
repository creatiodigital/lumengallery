'use server'

/**
 * GA4-fed dashboard analytics. Admin-only. One in-memory cache per server
 * instance, 1h TTL — the dashboard is a signal page, not a live monitor,
 * and GA4 data itself lags hours anyway.
 */
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
  /** ISO timestamp of the underlying GA4 fetch (cache-aware). */
  fetchedAt: string
}

export type AnalyticsResult =
  | { ok: true; data: DashboardAnalytics }
  | { ok: false; error: string; notConfigured?: boolean }

const CACHE_TTL_MS = 60 * 60 * 1000
const TOP_ARTWORKS_SHOWN = 8

let cache: { data: DashboardAnalytics; expiresAt: number } | null = null

export async function getDashboardAnalytics(): Promise<AnalyticsResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }

  if (!isGa4Configured()) {
    return { ok: false, notConfigured: true, error: 'GA4 is not configured for this environment.' }
  }

  if (cache && cache.expiresAt > Date.now()) {
    return { ok: true, data: cache.data }
  }

  try {
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
        title: artwork.title ?? artwork.name,
        artistName: `${artwork.user.name} ${artwork.user.lastName}`.trim(),
        sellsPrints: !!artwork.printEnabled && !!artwork.printPriceCents,
        views: row.views,
      })
      if (topArtworks.length >= TOP_ARTWORKS_SHOWN) break
    }

    const data: DashboardAnalytics = {
      topArtworks,
      countries: snapshot.countries,
      channels: snapshot.channels,
      fetchedAt: new Date().toISOString(),
    }
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
    return { ok: true, data }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'dashboard-analytics', level: 'warning' })
    return { ok: false, error: 'Could not load analytics from GA4.' }
  }
}
