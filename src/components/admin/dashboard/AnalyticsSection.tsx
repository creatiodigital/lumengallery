'use client'

import { useEffect, useState } from 'react'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { type AnalyticsResult, getDashboardAnalytics } from '@/app/admin/analytics/actions'

import styles from './AdminDashboard.module.scss'

// Module-level reuse: the data is by design up to 1h stale, so an admin
// bouncing between dashboard and order pages shouldn't re-POST the action
// on every mount. Successful results only — errors always retry.
let lastGoodResult: AnalyticsResult | null = null

type Row = { key: string; label: React.ReactNode; value: number }

const AnalyticsCard = ({
  title,
  emptyMessage,
  rows,
}: {
  title: string
  emptyMessage: string
  rows: Row[]
}) => (
  <div className={styles.analyticsCard}>
    <h3 className={styles.analyticsCardTitle}>{title}</h3>
    {rows.length === 0 && <p className={styles.analyticsHint}>{emptyMessage}</p>}
    <ol className={styles.analyticsList}>
      {rows.map((row) => (
        <li key={row.key} className={styles.analyticsRow}>
          <span className={styles.analyticsLabel}>{row.label}</span>
          <span className={styles.analyticsValue}>{row.value}</span>
        </li>
      ))}
    </ol>
  </div>
)

/**
 * GA4 traffic cards — production data regardless of environment (the GA tag
 * only runs on prod). Self-contained: fetches on mount, renders a muted hint
 * when GA4 env vars are missing, and an error line when the API fails.
 * Revenue/order truth intentionally stays out — that belongs to our own DB.
 */
export const AnalyticsSection = () => {
  const [result, setResult] = useState<AnalyticsResult | null>(lastGoodResult)

  useEffect(() => {
    if (lastGoodResult?.ok) return
    getDashboardAnalytics()
      .then((res) => {
        if (res.ok) lastGoodResult = res
        setResult(res)
      })
      .catch(() => {
        // Transport-level failure (offline, rolling deploy) — the action's
        // own try/catch never saw it, so surface the same soft error here.
        setResult({ ok: false, error: 'Could not load analytics. Reload to retry.' })
      })
  }, [])

  return (
    <section className={dashboardStyles.section}>
      <div className={dashboardStyles.sectionHeader}>
        <h2 className={dashboardStyles.sectionTitle}>Site analytics</h2>
      </div>
      <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
        Production traffic, last 30 days, via Google Analytics. Consenting visitors plus
        Google&rsquo;s modeling — read as trends, not a census.
        {result?.ok && (
          <>
            {' '}
            Updated {new Date(result.data.fetchedAt).toLocaleString('en-GB', { hour12: false })}.
          </>
        )}
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
          <AnalyticsCard
            title="Most viewed artworks"
            emptyMessage="No artwork views recorded yet."
            rows={result.data.topArtworks.map((a) => ({
              key: a.slug,
              value: a.views,
              label: (
                <>
                  {a.title}
                  <span className={styles.analyticsMeta}>
                    {a.artistName}
                    {!a.sellsPrints && <span className={styles.analyticsFlag}> · no prints</span>}
                  </span>
                </>
              ),
            }))}
          />
          <AnalyticsCard
            title="Visitors by country"
            emptyMessage="No sessions recorded yet."
            rows={result.data.countries.map((c) => ({
              key: c.country,
              label: c.country,
              value: c.sessions,
            }))}
          />
          <AnalyticsCard
            title="Traffic channels"
            emptyMessage="No sessions recorded yet."
            rows={result.data.channels.map((c) => ({
              key: c.channel,
              label: c.channel,
              value: c.sessions,
            }))}
          />
        </div>
      )}
    </section>
  )
}
