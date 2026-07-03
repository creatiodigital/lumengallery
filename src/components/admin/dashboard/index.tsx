'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { listOrders } from '@/app/admin/orders/actions'
import {
  clearAllTestData,
  getTestDataCounts,
} from '@/app/admin/dev-cleanup/actions'
import { type AttentionMetric, countAttentionMetrics } from '@/lib/orders/orderBuckets'

// Dev/staging-only cleanup controls. NEXT_PUBLIC_APP_ENV is inlined at build
// time, so on production this is a compile-time false and the whole section
// (plus its imports' code paths) never renders. The server actions carry the
// authoritative guard — this flag is just UI.
const DEV_CLEANUP_ALLOWED = process.env.NEXT_PUBLIC_APP_ENV !== 'production'

import styles from './AdminDashboard.module.scss'

// Counter cards surface what needs the admin's attention right now. Each
// carries a `metric` and reads its live count from countAttentionMetrics
// (same bucketOf logic as the orders tabs — single source of truth).
// Ordered by urgency: buyer-money / legal exposure first, payouts last.
// A card only takes its red/amber tone when its count > 0 (see render),
// so a clean panel is all-gray and the eye lands on what needs action.
type CounterCard = {
  label: string
  metric: AttentionMetric
  href: string
  tone?: 'red' | 'amber' | 'neutral'
}

const URGENT_COUNTERS: CounterCard[] = [
  { label: 'Refund still owed', metric: 'refundOwed', href: '/admin/orders', tone: 'red' },
  { label: 'Needs attention', metric: 'attention', href: '/admin/orders', tone: 'red' },
  { label: 'New', metric: 'new', href: '/admin/orders', tone: 'amber' },
  {
    label: 'Awaiting placement at TPS',
    metric: 'toPlace',
    href: '/admin/orders',
    tone: 'amber',
  },
  {
    label: 'Delivered, artist not paid',
    metric: 'deliveredUnpaid',
    href: '/admin/orders',
    tone: 'amber',
  },
]

type Hub = {
  label: string
  description: string
  href: string
}

const NAV_HUBS: Hub[] = [
  {
    label: 'Orders',
    description: 'Buyer orders, fulfillment stages, refunds, payouts.',
    href: '/admin/orders',
  },
  {
    label: 'Edition Sales',
    description: 'Numbered limited-edition copies reserved or sold — the authoritative ledger.',
    href: '/admin/edition-sales',
  },
  {
    label: 'Users',
    description: 'Artists, admins, curators — invite, publish, impersonate.',
    href: '/admin/users',
  },
  {
    label: 'Exhibitions',
    description: 'Exhibition pages, curation, preview links.',
    href: '/admin/exhibitions',
  },
  {
    label: 'Content',
    description: 'CMS pages — landing, About, Prints, Terms, Privacy, etc.',
    href: '/admin/content',
  },
  {
    label: 'Payouts',
    description: 'Artist payout history, manual payouts, Stripe Connect status.',
    href: '/admin/payouts',
  },
  {
    label: 'Invoices',
    description:
      'Gallery-issued invoices — view, filter by date & client, download, and export for the accountant.',
    href: '/admin/invoices',
  },
]

export const DashboardAdmin = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [metrics, setMetrics] = useState<Record<AttentionMetric, number> | null>(null)

  // Dev-cleanup state (section only renders outside production).
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false)
  const [cleanupCounts, setCleanupCounts] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        router.push('/')
      }
    }
  }, [sessionStatus, session, router])

  // Live counts for the "Needs your attention" cards. Reuses the orders
  // list's bucketOf so the dashboard never drifts from the tab badges.
  const loadCounts = useCallback(async () => {
    const res = await listOrders()
    if (res.ok) setMetrics(countAttentionMetrics(res.orders))
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') loadCounts()
  }, [sessionStatus, loadCounts])

  const openCleanupConfirm = useCallback(async () => {
    setCleanupResult(null)
    setCleanupCounts(null)
    setCleanupConfirmOpen(true)
    const res = await getTestDataCounts()
    setCleanupCounts(
      res.ok
        ? `${res.counts.printOrders} orders, ${res.counts.invoices} invoices, ` +
            `${res.counts.pendingCarts} staged carts, ${res.counts.editionNumbersHeld} held edition numbers`
        : res.error,
    )
  }, [])

  const handleClearTestData = useCallback(async () => {
    setCleaning(true)
    const res = await clearAllTestData()
    setCleaning(false)
    setCleanupConfirmOpen(false)
    if (res.ok) {
      const s = res.summary
      setCleanupResult(
        `Cleared: ${s.printOrdersDeleted} orders, ${s.invoicesDeleted} invoices ` +
          `(${s.invoicePdfsDeleted} PDFs), ${s.pendingCartsDeleted} staged carts. ` +
          `${s.editionNumbersReset} edition numbers returned to the pool` +
          (s.editionSlotsBackfilled ? `, ${s.editionSlotsBackfilled} slots backfilled.` : '.'),
      )
      loadCounts()
    } else {
      setCleanupResult(`Cleanup failed: ${res.error}`)
    }
  }, [loadCounts])

  if (sessionStatus === 'loading') {
    return (
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )
  }

  const userType = session?.user?.userType
  if (sessionStatus === 'unauthenticated' || (userType !== 'admin' && userType !== 'superAdmin')) {
    return <div className={dashboardStyles.page}>Not authorized</div>
  }

  return (
    <DashboardLayout>
      <h1 className={dashboardStyles.pageTitle}>Admin Dashboard</h1>

      {/* Urgent — what needs attention right now. Counters are
          placeholders (0) until we wire a server action that returns
          counts per bucket. The layout is the focus here. */}
      <section className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Needs your attention</h2>
        </div>
        <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
          Time-sensitive items across orders and inquiries. Click any card to jump to the relevant
          list.
        </p>
        <div className={styles.counterGrid}>
          {URGENT_COUNTERS.map((c) => {
            const count = metrics ? metrics[c.metric] : 0
            // Tone only kicks in when there's actually work — a 0 stays
            // neutral gray so the eye lands on the cards that need action.
            const toneClass = count > 0 && c.tone ? styles[`tone_${c.tone}`] : ''
            return (
              <Link key={c.label} href={c.href} className={`${styles.counterCard} ${toneClass}`}>
                <div className={styles.counterValue}>{count}</div>
                <div className={styles.counterLabel}>{c.label}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Action queue — items that should be triaged this week. Empty
          state for now; will populate with stuck orders, artists
          missing Stripe onboarding, recent webhook/cert failures
          from the event log. */}
      <section className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Action queue</h2>
        </div>
        <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
          Recent issues and items aging in their current state — coming soon.
        </p>
        <div className={styles.placeholderBlock}>
          Stuck orders, onboarding-incomplete artists, and recent webhook failures will surface
          here. Wired in a follow-up pass.
        </div>
      </section>

      {/* Navigation hubs — entry points to the workspaces. Replaces
          the old inline tables on the dashboard so this page stays a
          signal page, not a workspace. */}
      <section className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Manage</h2>
        </div>
        <div className={styles.hubGrid}>
          {NAV_HUBS.map((h) => (
            <Link key={h.label} href={h.href} className={styles.hubCard}>
              <div className={styles.hubLabel}>{h.label}</div>
              <div className={styles.hubDescription}>{h.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Analytics — empty space reserved for revenue, top artworks,
          buyer geography, and the funnel. Keeping the layout slot
          here so we know where it lives once we have data sources. */}
      <section className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Analytics</h2>
        </div>
        <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
          Last-30-days revenue, top-selling artworks, buyer geography, and the artwork → wizard →
          checkout → payment funnel — coming soon.
        </p>
        <div className={styles.placeholderBlock}>Reserved space for charts and tables.</div>
      </section>

      {/* Dev cleanup — localhost + staging ONLY (compile-time gated above;
          the server actions enforce it authoritatively). One button to clear
          all the test noise: orders, invoices, staged carts, edition holds. */}
      {DEV_CLEANUP_ALLOWED && (
        <section className={dashboardStyles.section}>
          <div className={dashboardStyles.sectionHeader}>
            <h2 className={dashboardStyles.sectionTitle}>Dev cleanup</h2>
          </div>
          <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
            Test environment only ({process.env.NEXT_PUBLIC_APP_ENV ?? 'development'}) — this
            section does not exist in production. Wipes ALL orders, invoices (and their PDFs),
            staged carts, and resets every limited-edition series to fully available. Local and
            staging share this database.
          </p>
          <Button
            font="dashboard"
            variant="danger"
            label="Clear all test orders & invoices"
            onClick={() => void openCleanupConfirm()}
          />
          {cleanupResult && (
            <p className={dashboardStyles.sectionDescription} style={{ margin: '12px 0 0 0' }}>
              {cleanupResult}
            </p>
          )}
        </section>
      )}

      {cleanupConfirmOpen && (
        <ConfirmModal
          title="Clear ALL test data?"
          message={
            <>
              <p>
                This deletes every order, invoice (register rows + PDFs), and staged cart, and
                returns every limited-edition number to the pool — on the SHARED dev database
                (localhost + staging together).
              </p>
              <p style={{ marginTop: 8 }}>
                {cleanupCounts ? `Right now that is: ${cleanupCounts}.` : 'Counting…'}
              </p>
            </>
          }
          confirmLabel="Yes, clear everything"
          destructive
          busy={cleaning}
          onConfirm={() => void handleClearTestData()}
          onCancel={() => setCleanupConfirmOpen(false)}
        />
      )}
    </DashboardLayout>
  )
}
