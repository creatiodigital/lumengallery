# GA4 Dashboard Analytics Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three GA4-fed cards on the admin dashboard — top viewed artworks (with print status), visitors by country, traffic channels — answering "what should I print-enable next", "is my non-Spain audience real", and "which promotion channel works".

**Architecture:** A thin server-side GA4 adapter (`src/lib/analytics/ga4.ts`) calls the Google Analytics Data API with service-account credentials from env vars, batching all three reports in one HTTP request. An authed server action caches the result in-memory for 1 hour and enriches artwork paths with title/artist/print-status from Prisma. A self-contained client component renders the section on the admin dashboard, degrading gracefully when GA4 env vars are absent (shows a muted "not configured" hint — useful when verifying staging).

**Tech Stack:** `@google-analytics/data` (official Google client — **sanctioned by Eduardo 2026-07-05**), Next.js server actions, Prisma, existing admin dashboard SCSS module.

## Global Constraints

- GA4 is production-only on the tag side (`NEXT_PUBLIC_GA_MEASUREMENT_ID` set only in Vercel Production) — the Data API always reads the PRODUCTION property, from every environment.
- New env vars (server-only, never `NEXT_PUBLIC_`): `GA4_PROPERTY_ID` (numeric string), `GA_SERVICE_ACCOUNT_KEY` (full service-account JSON as one line).
- Everything fails soft: missing env vars, API errors, or quota issues must never break the dashboard — the section explains itself instead.
- No 3D-exhibition tracking (explicitly out of scope — Eduardo 2026-07-05). Artwork views = standalone `/artworks/<slug>` page views only.
- No new e2e specs: the feature is a read-only external-API view; verification = the diagnostic script + staging smoke test. (Playwright-only rule untouched.)
- Buyer-facing copy: none (admin-only feature).
- Dashboard styling: rounded corners / 6px radius, matches existing counter & hub cards.
- Commit at the end of the chore on `feat/AR-131-improve-mobile-view`; NO push (Eduardo pushes/merges).

---

### Task 1: GA4 adapter library

**Files:**

- Create: `src/lib/analytics/ga4.ts`
- Modify: `package.json` (add `@google-analytics/data`)

**Interfaces:**

- Produces: `isGa4Configured(): boolean`, `fetchGa4Snapshot(): Promise<Ga4Snapshot>`, and the types below — Task 2's script and Task 3's action consume them verbatim.

- [ ] **Step 1: Install the sanctioned dependency**

```bash
pnpm add @google-analytics/data
```

- [ ] **Step 2: Write the adapter**

```ts
// src/lib/analytics/ga4.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Thin adapter over the GA4 Data API. Server-only: credentials come from
// GA_SERVICE_ACCOUNT_KEY (full service-account JSON, one line) and
// GA4_PROPERTY_ID (the numeric property id from GA4 Admin → Property
// settings). The GA tag only runs on production, so whichever environment
// calls this, the numbers are always production traffic.

export type Ga4ArtworkViews = { slug: string; views: number }
export type Ga4CountryRow = { country: string; sessions: number }
export type Ga4ChannelRow = { channel: string; sessions: number }

export type Ga4Snapshot = {
  topArtworks: Ga4ArtworkViews[]
  countries: Ga4CountryRow[]
  channels: Ga4ChannelRow[]
}

const RANGE = { startDate: '30daysAgo', endDate: 'today' }
// Fetch more artwork paths than we display: rows are per-path and get
// filtered to exact /artworks/<slug> matches below.
const ARTWORK_ROW_LIMIT = 50
const COUNTRY_LIMIT = 10
const CHANNEL_LIMIT = 8

type Ga4Config = { propertyId: string; clientEmail: string; privateKey: string }

function getConfig(): Ga4Config | null {
  const propertyId = process.env.GA4_PROPERTY_ID
  const rawKey = process.env.GA_SERVICE_ACCOUNT_KEY
  if (!propertyId || !rawKey) return null
  try {
    const parsed = JSON.parse(rawKey) as { client_email?: string; private_key?: string }
    if (!parsed.client_email || !parsed.private_key) return null
    return { propertyId, clientEmail: parsed.client_email, privateKey: parsed.private_key }
  } catch {
    return null
  }
}

export function isGa4Configured(): boolean {
  return getConfig() !== null
}

// Module-level client reuse across invocations of a warm serverless instance.
let client: BetaAnalyticsDataClient | null = null

function getClient(config: Ga4Config): BetaAnalyticsDataClient {
  client ??= new BetaAnalyticsDataClient({
    credentials: { client_email: config.clientEmail, private_key: config.privateKey },
  })
  return client
}

/** Exact /artworks/<slug> pages only — wizard/checkout subroutes excluded. */
const ARTWORK_PATH = /^\/artworks\/([^/]+)$/

/**
 * One batched Data API call → the three dashboard datasets. Throws when not
 * configured or on API failure — the caller owns graceful degradation.
 */
export async function fetchGa4Snapshot(): Promise<Ga4Snapshot> {
  const config = getConfig()
  if (!config) throw new Error('GA4 is not configured')

  const [response] = await getClient(config).batchRunReports({
    property: `properties/${config.propertyId}`,
    requests: [
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'BEGINS_WITH', value: '/artworks/' },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: ARTWORK_ROW_LIMIT,
      },
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: COUNTRY_LIMIT,
      },
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: CHANNEL_LIMIT,
      },
    ],
  })

  const [artworkReport, countryReport, channelReport] = response.reports ?? []

  const topArtworks: Ga4ArtworkViews[] = []
  for (const row of artworkReport?.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? ''
    const match = ARTWORK_PATH.exec(path)
    if (!match) continue
    topArtworks.push({ slug: match[1], views: Number(row.metricValues?.[0]?.value ?? 0) })
  }

  const countries: Ga4CountryRow[] = (countryReport?.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }))

  const channels: Ga4ChannelRow[] = (channelReport?.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }))

  return { topArtworks, countries, channels }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`
Expected: clean exit, no output after the tsc line.

### Task 2: Diagnostic script (credentials + query smoke test)

**Files:**

- Create: `scripts/diag-ga4.ts`

**Interfaces:**

- Consumes: `isGa4Configured()`, `fetchGa4Snapshot()` from Task 1.

- [ ] **Step 1: Write the script**

```ts
// Read-only GA4 connectivity check: verifies the service-account key +
// property id and prints the three dashboard datasets.
// Run with: npx dotenv -e .env.local -- npx tsx scripts/diag-ga4.ts
import { fetchGa4Snapshot, isGa4Configured } from '@/lib/analytics/ga4'

async function main() {
  if (!isGa4Configured()) {
    console.log('GA4 NOT configured — set GA4_PROPERTY_ID and GA_SERVICE_ACCOUNT_KEY in .env.local')
    process.exitCode = 1
    return
  }
  const snapshot = await fetchGa4Snapshot()
  console.log('— Top artworks (30d page views) —')
  for (const a of snapshot.topArtworks) console.log(`  ${a.views}\t/artworks/${a.slug}`)
  console.log('— Countries (30d sessions) —')
  for (const c of snapshot.countries) console.log(`  ${c.sessions}\t${c.country}`)
  console.log('— Channels (30d sessions) —')
  for (const c of snapshot.channels) console.log(`  ${c.sessions}\t${c.channel}`)
}

main().catch((err) => {
  console.error('GA4 diagnostic failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
```

- [ ] **Step 2: Run it (before credentials exist)**

Run: `npx dotenv -e .env.local -- npx tsx scripts/diag-ga4.ts`
Expected: `GA4 NOT configured — …` with exit code 1 (env vars not set yet). After Eduardo completes the setup checklist (bottom of this plan) the same command must print three data blocks.

### Task 3: Server action — auth, cache, artwork enrichment

**Files:**

- Create: `src/app/admin/analytics/actions.ts`

**Interfaces:**

- Consumes: `fetchGa4Snapshot()`, `isGa4Configured()` (Task 1); `requireAdminAction()` from `@/lib/authUtils`; `prisma` from `@/lib/prisma`.
- Produces: `getDashboardAnalytics(): Promise<AnalyticsResult>` and the `DashboardAnalytics` type — Task 4's component consumes both verbatim.

- [ ] **Step 1: Write the action**

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: clean. (Note: `Artwork.slug` is nullable in Prisma — if tsc complains about `Map<string | null, …>`, filter with `artworks.filter((a) => a.slug !== null)` before building the map and the `bySlug.get` stays type-safe.)

### Task 4: Dashboard section component + styles

**Files:**

- Create: `src/components/admin/dashboard/AnalyticsSection.tsx`
- Modify: `src/components/admin/dashboard/index.tsx` (render the section between the "Manage" hubs and "Dev cleanup")
- Modify: `src/components/admin/dashboard/AdminDashboard.module.scss` (append card styles)

**Interfaces:**

- Consumes: `getDashboardAnalytics()`, types `DashboardAnalytics`, `AnalyticsResult` (Task 3).

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { type AnalyticsResult, getDashboardAnalytics } from '@/app/admin/analytics/actions'

import styles from './AdminDashboard.module.scss'

/**
 * GA4 traffic cards — production data regardless of environment (the GA tag
 * only runs on prod). Self-contained: fetches on mount, renders a muted hint
 * when GA4 env vars are missing, and an error line when the API fails.
 * Revenue/order truth intentionally stays out — that belongs to our own DB.
 */
export const AnalyticsSection = () => {
  const [result, setResult] = useState<AnalyticsResult | null>(null)

  useEffect(() => {
    getDashboardAnalytics().then(setResult)
  }, [])

  return (
    <section className={dashboardStyles.section}>
      <div className={dashboardStyles.sectionHeader}>
        <h2 className={dashboardStyles.sectionTitle}>Site analytics</h2>
      </div>
      <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
        Production traffic, last 30 days, via Google Analytics. Consenting visitors plus
        Google&rsquo;s modeling — read as trends, not a census.
      </p>

      {result === null && <p className={styles.analyticsHint}>Loading analytics…</p>}

      {result && !result.ok && (
        <p className={styles.analyticsHint}>
          {result.notConfigured
            ? 'GA4 is not configured — set GA4_PROPERTY_ID and GA_SERVICE_ACCOUNT_KEY to enable this section.'
            : result.error}
        </p>
      )}

      {result?.ok && (
        <div className={styles.analyticsGrid}>
          <div className={styles.analyticsCard}>
            <h3 className={styles.analyticsCardTitle}>Most viewed artworks</h3>
            {result.data.topArtworks.length === 0 && (
              <p className={styles.analyticsHint}>No artwork views recorded yet.</p>
            )}
            <ol className={styles.analyticsList}>
              {result.data.topArtworks.map((a) => (
                <li key={a.slug} className={styles.analyticsRow}>
                  <span className={styles.analyticsLabel}>
                    {a.title}
                    <span className={styles.analyticsMeta}>
                      {a.artistName}
                      {!a.sellsPrints && <span className={styles.analyticsFlag}> · no prints</span>}
                    </span>
                  </span>
                  <span className={styles.analyticsValue}>{a.views}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.analyticsCard}>
            <h3 className={styles.analyticsCardTitle}>Visitors by country</h3>
            {result.data.countries.length === 0 && (
              <p className={styles.analyticsHint}>No sessions recorded yet.</p>
            )}
            <ol className={styles.analyticsList}>
              {result.data.countries.map((c) => (
                <li key={c.country} className={styles.analyticsRow}>
                  <span className={styles.analyticsLabel}>{c.country}</span>
                  <span className={styles.analyticsValue}>{c.sessions}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.analyticsCard}>
            <h3 className={styles.analyticsCardTitle}>Traffic channels</h3>
            {result.data.channels.length === 0 && (
              <p className={styles.analyticsHint}>No sessions recorded yet.</p>
            )}
            <ol className={styles.analyticsList}>
              {result.data.channels.map((c) => (
                <li key={c.channel} className={styles.analyticsRow}>
                  <span className={styles.analyticsLabel}>{c.channel}</span>
                  <span className={styles.analyticsValue}>{c.sessions}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Render it on the dashboard**

In `src/components/admin/dashboard/index.tsx`, add the import and place the section AFTER the "Manage" hubs `</section>` and BEFORE the `{DEV_CLEANUP_ALLOWED && (` block:

```tsx
import { AnalyticsSection } from './AnalyticsSection'
// …
;<AnalyticsSection />
```

- [ ] **Step 3: Append styles**

Append to `src/components/admin/dashboard/AdminDashboard.module.scss`:

```scss
// ── Site analytics (GA4) ──────────────────────────────────────
.analyticsGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);

  @include media-down(lg) {
    grid-template-columns: 1fr;
  }
}

.analyticsCard {
  padding: var(--space-5);
  background: var(--color-gray-10);
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  min-width: 0;
}

.analyticsCardTitle {
  margin: 0 0 var(--space-3);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.analyticsList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.analyticsRow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.analyticsLabel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 13px;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

.analyticsMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

// The actionable signal: a heavily-viewed artwork that is NOT sellable as a
// print — demand with nothing to buy.
.analyticsFlag {
  color: var(--color-badge-warning-text);
}

.analyticsValue {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.analyticsHint {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

Note: `AdminDashboard.module.scss` must have `@use '@/styles/mixins' as *;` at the top for `media-down` — add it if absent.

- [ ] **Step 4: Verify locally (unconfigured path)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. Then on `pnpm dev` → `/admin`: the "Site analytics" section shows the muted "GA4 is not configured…" hint (until env vars are added).

### Task 5: Format, commit

- [ ] **Step 1: Format changed files**

Run: `npx prettier --write src/lib/analytics/ga4.ts scripts/diag-ga4.ts src/app/admin/analytics/actions.ts src/components/admin/dashboard/AnalyticsSection.tsx src/components/admin/dashboard/index.tsx src/components/admin/dashboard/AdminDashboard.module.scss docs/superpowers/plans/2026-07-05-ga4-dashboard-analytics.md`

- [ ] **Step 2: Final checks**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 3: Commit (NO push)**

```bash
git add -A
git commit -m "AR-131: GA4 analytics cards on admin dashboard"
```

---

## Eduardo's setup checklist (required before the cards show data)

Do once, ~10 minutes:

1. **Google Cloud**: [console.cloud.google.com](https://console.cloud.google.com) → create (or pick) a project → _APIs & Services → Library_ → enable **Google Analytics Data API** → _IAM & Admin → Service Accounts_ → _Create service account_ (name e.g. `theartroom-dashboard`, no roles needed) → open it → _Keys → Add key → JSON_ → download.
2. **GA4 access**: [analytics.google.com](https://analytics.google.com) → _Admin → Property access management_ → _+_ → add the service account's email (`…@….iam.gserviceaccount.com`) with **Viewer** role.
3. **Property ID**: _Admin → Property settings_ → copy the numeric **Property ID**.
4. **Env vars** — local `.env.local`, then Vercel (set in BOTH Preview/staging and Production; they read the same prod GA property):
   - `GA4_PROPERTY_ID=<numeric id>`
   - `GA_SERVICE_ACCOUNT_KEY=<entire JSON file content on one line>`
5. **Verify locally**: `npx dotenv -e .env.local -- npx tsx scripts/diag-ga4.ts` → prints three data blocks.
6. Redeploy staging → `/admin` shows the three cards with production traffic.
