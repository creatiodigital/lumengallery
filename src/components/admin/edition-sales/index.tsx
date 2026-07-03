'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'

import {
  listEditionSales,
  releaseOrphanedEditionNumber,
  type EditionSaleRow,
} from '@/app/admin/orders/actions'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '—'

/**
 * Admin ledger of every numbered limited-edition copy that's been
 * reserved or sold — which number, to whom, for which artwork + variant,
 * and whether it's been mirrored as sold in TPS. Our authoritative record.
 */
export const AdminEditionSales = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [sales, setSales] = useState<EditionSaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-row release (manual cleanup of orphaned, order-less reservations —
  // frees the number back to available without removing the slot).
  const [releaseTarget, setReleaseTarget] = useState<EditionSaleRow | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

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
    const res = await listEditionSales()
    if (res.ok) setSales(res.sales)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const handleRelease = async () => {
    if (!releaseTarget) return
    setReleasing(true)
    setReleaseError(null)
    const res = await releaseOrphanedEditionNumber(releaseTarget.id)
    setReleasing(false)
    if (res.ok) {
      setReleaseTarget(null)
      await load()
    } else {
      setReleaseError(res.error)
    }
  }

  const closeRelease = () => {
    if (releasing) return
    setReleaseTarget(null)
    setReleaseError(null)
  }

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Limited edition sales</h1>
      <p className={dashboardStyles.sectionDescription}>
        Every numbered copy that&apos;s been reserved or sold — who holds it, for which artwork and
        variant, and whether it&apos;s been mirrored as sold in The Print Space. Our authoritative
        record. Newest first.
      </p>

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      <div className={dashboardStyles.section}>
        {loading ? (
          <p className={dashboardStyles.sectionDescription}>Loading…</p>
        ) : sales.length === 0 ? (
          <EmptyState message="No limited-edition copies sold yet." />
        ) : (
          <>
            <p className={dashboardStyles.sectionDescription}>
              <strong>{sales.length}</strong> numbered copies reserved or sold
            </p>
            <table className={dashboardStyles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Artwork</th>
                  <th>Variant</th>
                  <th>Number</th>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th>TPS</th>
                  <th>Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.date)}</td>
                    <td>
                      <div>
                        {s.artworkSlug ? (
                          <Link
                            href={`/artworks/${s.artworkSlug}`}
                            style={{ textDecoration: 'underline' }}
                          >
                            {s.artworkTitle}
                          </Link>
                        ) : (
                          s.artworkTitle
                        )}
                      </div>
                      {s.artistName && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                          {s.artistName}
                        </div>
                      )}
                    </td>
                    <td>{s.variantName}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {s.number}/{s.editionSize}
                    </td>
                    <td>
                      <div>{s.buyerName ?? '—'}</div>
                      {s.buyerEmail && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                          {s.buyerEmail}
                        </div>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{s.state}</td>
                    <td>{s.mirroredInTps ? '✓ mirrored' : '—'}</td>
                    <td>
                      {s.orderId ? (
                        <Link
                          href={`/admin/orders/${s.orderId}`}
                          style={{ fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
                        >
                          #{s.orderId.slice(0, 8)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {/* Orphaned (order-less) rows can be released from here —
                          freed back to available, keeping the numbered slot.
                          Order-bound copies are managed via their order. */}
                      {s.orderId ? (
                        '—'
                      ) : (
                        <Button
                          variant="secondary"
                          font="dashboard"
                          size="small"
                          label="Release"
                          onClick={() => {
                            setReleaseError(null)
                            setReleaseTarget(s)
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {releaseTarget && (
        <ConfirmModal
          title="Release this number?"
          message={
            <>
              This frees copy{' '}
              <strong>
                {releaseTarget.number}/{releaseTarget.editionSize}
              </strong>{' '}
              of <strong>{releaseTarget.artworkTitle}</strong> ({releaseTarget.variantName}) back to{' '}
              <strong>available</strong> — it leaves this ledger and can be sold again. The numbered
              slot stays in place, so the edition isn&apos;t gapped.
            </>
          }
          warning={
            releaseError ? (
              <>⚠️ {releaseError}</>
            ) : releaseTarget.state === 'sold' ? (
              <>
                This copy is marked <strong>sold</strong> — only release it if the print was never
                produced.
              </>
            ) : null
          }
          confirmLabel="Yes, release it"
          cancelLabel="Keep it"
          busy={releasing}
          onConfirm={handleRelease}
          onCancel={closeRelease}
        />
      )}
    </DashboardLayout>
  )
}
