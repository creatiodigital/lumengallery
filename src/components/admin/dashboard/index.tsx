'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { LoadingBar } from '@/components/ui/LoadingBar'

import styles from './AdminDashboard.module.scss'

// Counter cards surface what needs the admin's attention right now.
// Each routes to a filtered view once the bucket query-param wiring
// lands; for now we point at the parent list and let the admin pick
// the tab manually. Counts are 0 placeholders until we wire the
// server action — the goal of this pass is layout, not data.
type CounterCard = {
  label: string
  count: number
  href: string
  tone?: 'red' | 'amber' | 'neutral'
}

const URGENT_COUNTERS: CounterCard[] = [
  { label: 'Awaiting placement at TPS', count: 0, href: '/admin/orders', tone: 'amber' },
  { label: 'Needs attention', count: 0, href: '/admin/orders', tone: 'red' },
  { label: 'Refund still owed', count: 0, href: '/admin/orders', tone: 'red' },
  { label: 'Delivered, artist not paid', count: 0, href: '/admin/orders', tone: 'amber' },
  { label: 'Unanswered inquiries', count: 0, href: '/admin/dashboard', tone: 'amber' },
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
]

export const DashboardAdmin = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

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
          {URGENT_COUNTERS.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className={`${styles.counterCard} ${c.tone ? styles[`tone_${c.tone}`] : ''}`}
            >
              <div className={styles.counterValue}>{c.count}</div>
              <div className={styles.counterLabel}>{c.label}</div>
            </Link>
          ))}
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
          Stuck orders, onboarding-incomplete artists, and recent webhook / certificate failures
          will surface here. Wired in a follow-up pass.
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
    </DashboardLayout>
  )
}
