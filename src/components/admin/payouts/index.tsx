'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatEuro } from '@/lib/print-providers/format'

import { listArtistPayouts, type AdminPayoutRow } from '@/app/admin/orders/actions'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

export const AdminPayouts = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const t = session?.user?.userType
      if (t !== 'admin' && t !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const load = useCallback(async () => {
    setError(null)
    const res = await listArtistPayouts()
    if (res.ok) setPayouts(res.payouts)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const totalCents = useMemo(() => payouts.reduce((sum, p) => sum + p.amountCents, 0), [payouts])

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Artist payouts</h1>
      <p className={dashboardStyles.sectionDescription}>
        Every payout that&apos;s been released from your Stripe balance to an artist. Use this for
        tax records and accounting. Newest first.
      </p>

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      <div className={dashboardStyles.section}>
        {loading ? (
          <p className={dashboardStyles.sectionDescription}>Loading…</p>
        ) : payouts.length === 0 ? (
          <EmptyState message="No artist payouts released yet." />
        ) : (
          <>
            <p className={dashboardStyles.sectionDescription}>
              <strong>{payouts.length}</strong> payouts · <strong>{formatEuro(totalCents)}</strong>{' '}
              total released
            </p>
            <table className={dashboardStyles.table}>
              <thead>
                <tr>
                  <th>Date paid</th>
                  <th>Artist</th>
                  <th>Artwork</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.rowKey}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.paidOutAt)}</td>
                    <td>
                      <div>{p.artistName}</div>
                      {p.artistEmail && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                          {p.artistEmail}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.artworkTitle}
                      {/* Cart orders contribute one row per line — flag the
                          source so a multi-row order reads clearly. */}
                      {p.source === 'item' && (
                        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}> · cart item</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatEuro(p.amountCents)}
                    </td>
                    <td>
                      <Link
                        href={`/admin/orders/${p.orderId}`}
                        style={{ fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
                      >
                        #{p.orderId.slice(0, 8)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
