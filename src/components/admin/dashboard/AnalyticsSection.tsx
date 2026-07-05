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
