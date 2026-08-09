'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Gift, Palette, PrinterCheck, type LucideIcon } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'

import {
  advanceOffPlatformOrder,
  cancelOffPlatformOrder,
  deleteCancelledOffPlatformOrder,
  listOffPlatformOrders,
  markOffPlatformArtistPaid,
  type OffPlatformOrderRow,
} from '@/app/admin/orders/actions'
import { OFF_PLATFORM_KIND_LABELS, type OffPlatformKind } from '@/lib/orders/offPlatformKinds'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

/** Lucide marks for the off-platform kinds — never system emoji (house rule). */
const KIND_ICONS: Record<OffPlatformKind, LucideIcon> = {
  gift: Gift,
  artist_copy: Palette,
  test: PrinterCheck,
}

const KindMark = ({ kind }: { kind: OffPlatformKind }) => {
  const Icon = KIND_ICONS[kind]
  return Icon ? (
    <Icon
      size={14}
      strokeWidth={ICON_STROKE_WIDTH}
      style={{ verticalAlign: 'text-bottom', marginRight: 6 }}
      aria-hidden
    />
  ) : null
}

/** Stage flow mirrors PrintOrder's manual TPS pipeline (null = pending placement). */
const STAGES: { value: string | null; label: string; nextLabel: string }[] = [
  { value: null, label: 'To place at TPS', nextLabel: '' },
  { value: 'Placed', label: 'Placed', nextLabel: 'Mark placed at TPS' },
  { value: 'Started', label: 'In production', nextLabel: 'Production started' },
  { value: 'Shipped', label: 'Shipped', nextLabel: 'Mark shipped' },
  { value: 'Complete', label: 'Delivered', nextLabel: 'Mark delivered' },
]

const stageIndex = (status: string | null) => STAGES.findIndex((s) => s.value === status)

/**
 * Whether cancelling still returns the edition number to the pool. From
 * 'Started' onward a physical print carrying that number exists, so the number
 * stays consumed — otherwise the same copy could be sold to a buyer too, and
 * two prints would bear e.g. 29/50. Mirrors `stageAllowsEditionRelease` on the
 * server, which is the actual guard; this only keeps the wording honest.
 */
const cancelReleasesNumber = (status: string | null) => stageIndex(status) < 2

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })

/**
 * Off-platform orders — gifts, artist copies, test prints. Parcels produced
 * at TPS outside the paid pipeline: no Stripe, no invoice, no payout, no
 * buyer emails. Same manual fulfillment stages as regular orders so the
 * admin keeps control of every physical print in circulation.
 */
export const AdminGiftOrders = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [orders, setOrders] = useState<OffPlatformOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Shipped needs a tracking URL prompt; cancel needs a confirm.
  const [shipTarget, setShipTarget] = useState<OffPlatformOrderRow | null>(null)
  const [shipTracking, setShipTracking] = useState('')
  // "Copy address for TPS" feedback — id of the row copied last.
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<OffPlatformOrderRow | null>(null)
  const [payTarget, setPayTarget] = useState<OffPlatformOrderRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OffPlatformOrderRow | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

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
    const res = await listOffPlatformOrders()
    if (res.ok) setOrders(res.orders)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const advance = async (order: OffPlatformOrderRow, stage: string, trackingUrl?: string) => {
    setBusyId(order.id)
    setModalError(null)
    const res = await advanceOffPlatformOrder(order.id, stage, { trackingUrl })
    setBusyId(null)
    if (res.ok) {
      setShipTarget(null)
      setShipTracking('')
      await load()
    } else {
      setModalError(res.error)
      if (!shipTarget) setError(res.error)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setBusyId(cancelTarget.id)
    setModalError(null)
    const res = await cancelOffPlatformOrder(cancelTarget.id)
    setBusyId(null)
    if (res.ok) {
      setCancelTarget(null)
      await load()
    } else {
      setModalError(res.error)
    }
  }

  const handleMarkPaid = async () => {
    if (!payTarget) return
    setBusyId(payTarget.id)
    setModalError(null)
    const res = await markOffPlatformArtistPaid(payTarget.id)
    setBusyId(null)
    if (res.ok) {
      setPayTarget(null)
      await load()
    } else {
      setModalError(res.error)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    setModalError(null)
    const res = await deleteCancelledOffPlatformOrder(deleteTarget.id)
    setBusyId(null)
    if (res.ok) {
      setDeleteTarget(null)
      await load()
    } else {
      setModalError(res.error)
    }
  }

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Gift orders</h1>
      <p className={dashboardStyles.sectionDescription}>
        Gifts, artist copies and test prints — parcels produced at The Print Space outside the paid
        pipeline. No payment, invoice or buyer emails; the edition number is consumed in the ledger
        and the physical parcel walks the same stages as a regular order. Create one with{' '}
        <strong>Create gift order</strong> on any on-sale variant of an artwork.
      </p>

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      <div className={dashboardStyles.section}>
        {loading ? (
          <p className={dashboardStyles.sectionDescription}>Loading…</p>
        ) : orders.length === 0 ? (
          <EmptyState message="No gift orders yet — create one from the Edition Sales ledger." />
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Kind</th>
                <th>Recipient</th>
                <th>Copy</th>
                <th>Artist fee</th>
                <th>Status</th>
                <th>Tracking</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const idx = stageIndex(o.fulfillmentStatus)
                const cancelled = o.fulfillmentStatus === 'Cancelled'
                const next =
                  !cancelled && idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null
                return (
                  <tr key={o.id} style={cancelled ? { opacity: 0.55 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <KindMark kind={o.kind as OffPlatformKind} />
                      {OFF_PLATFORM_KIND_LABELS[o.kind as OffPlatformKind] ?? o.kind}
                    </td>
                    <td>
                      <div>{o.recipientName}</div>
                      {o.recipientAddress && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                          {[
                            o.recipientAddress.line1,
                            o.recipientAddress.line2,
                            `${o.recipientAddress.postalCode} ${o.recipientAddress.city}`,
                            o.recipientAddress.state,
                            o.recipientAddress.country,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                      {o.note && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{o.note}</div>
                      )}
                      {o.recipientAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            const a = o.recipientAddress
                            if (!a) return
                            const text = [
                              o.recipientName,
                              a.line1,
                              a.line2,
                              `${a.postalCode} ${a.city}`,
                              a.state,
                              a.country,
                              a.phone,
                            ]
                              .filter(Boolean)
                              .join('\n')
                            navigator.clipboard.writeText(text).then(
                              () => setCopiedId(o.id),
                              () => setCopiedId(null),
                            )
                          }}
                          style={{
                            marginTop: 4,
                            fontSize: 'var(--text-xs)',
                            textDecoration: 'underline',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'inherit',
                          }}
                        >
                          {copiedId === o.id ? '✓ copied' : 'Copy address for TPS'}
                        </button>
                      )}
                    </td>
                    <td>
                      {o.copies.map((c) => (
                        <div key={`${c.artworkTitle}-${c.number}`} style={{ whiteSpace: 'nowrap' }}>
                          {c.artworkTitle} · {c.variantName} · {c.number}/{c.editionSize}
                        </div>
                      ))}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {o.artistCents > 0 ? (
                        <>
                          <div>€{(o.artistCents / 100).toFixed(2)}</div>
                          {o.artistPaidAt ? (
                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                              ✓ paid {formatDate(o.artistPaidAt)}
                            </div>
                          ) : cancelled ? null : (
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null)
                                setPayTarget(o)
                              }}
                              style={{
                                fontSize: 'var(--text-xs)',
                                textDecoration: 'underline',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                color: 'inherit',
                              }}
                            >
                              Mark paid
                            </button>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {cancelled ? 'Cancelled' : (STAGES[idx]?.label ?? o.fulfillmentStatus)}
                    </td>
                    <td>
                      {o.trackingUrl ? (
                        <a
                          href={o.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
                        >
                          tracking ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {next && (
                        <Button
                          variant="primary"
                          font="dashboard"
                          size="small"
                          label={next.nextLabel}
                          disabled={busyId === o.id}
                          onClick={() => {
                            if (next.value === 'Shipped') {
                              setModalError(null)
                              setShipTracking(o.trackingUrl ?? '')
                              setShipTarget(o)
                            } else if (next.value) {
                              advance(o, next.value)
                            }
                          }}
                        />
                      )}{' '}
                      {!cancelled && (
                        <Button
                          variant="secondary"
                          font="dashboard"
                          size="small"
                          label="Cancel"
                          disabled={busyId === o.id}
                          onClick={() => {
                            setModalError(null)
                            setCancelTarget(o)
                          }}
                        />
                      )}
                      {cancelled && (
                        <Button
                          variant="secondary"
                          font="dashboard"
                          size="small"
                          label="Delete"
                          disabled={busyId === o.id}
                          onClick={() => {
                            setModalError(null)
                            setDeleteTarget(o)
                          }}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {shipTarget && (
        <ConfirmModal
          title="Mark shipped"
          message={
            <>
              <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                Marks <strong>{shipTarget.recipientName}</strong>&apos;s parcel as shipped. Paste
                the tracking link from The Print Space if there is one.
              </p>
              <input
                type="text"
                value={shipTracking}
                onChange={(e) => setShipTracking(e.target.value)}
                placeholder="https://… (optional)"
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid rgba(0,0,0,0.2)',
                  borderRadius: 4,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </>
          }
          warning={modalError ? <>⚠️ {modalError}</> : null}
          confirmLabel="Mark shipped"
          cancelLabel="Not yet"
          busy={busyId === shipTarget.id}
          onConfirm={() => advance(shipTarget, 'Shipped', shipTracking)}
          onCancel={() => {
            if (busyId) return
            setShipTarget(null)
            setModalError(null)
          }}
        />
      )}

      {payTarget && (
        <ConfirmModal
          title="Mark artist fee as paid?"
          message={
            <>
              Confirms you transferred <strong>€{(payTarget.artistCents / 100).toFixed(2)}</strong>{' '}
              to <strong>{payTarget.copies[0]?.artistName ?? 'the artist'}</strong> for this gifted
              copy. Include it in the artist&apos;s monthly invoice batch.
            </>
          }
          warning={modalError ? <>⚠️ {modalError}</> : null}
          confirmLabel="Yes, mark paid"
          cancelLabel="Not yet"
          busy={busyId === payTarget.id}
          onConfirm={handleMarkPaid}
          onCancel={() => {
            if (busyId) return
            setPayTarget(null)
            setModalError(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this cancelled gift order?"
          message={
            <>
              Permanently removes <strong>{deleteTarget.recipientName}</strong>&apos;s cancelled{' '}
              {OFF_PLATFORM_KIND_LABELS[deleteTarget.kind as OffPlatformKind] ?? deleteTarget.kind}{' '}
              from the list. Its edition number was already released when it was cancelled.
            </>
          }
          warning={modalError ? <>⚠️ {modalError}</> : null}
          confirmLabel="Yes, delete permanently"
          cancelLabel="Keep it"
          destructive
          busy={busyId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => {
            if (busyId) return
            setDeleteTarget(null)
            setModalError(null)
          }}
        />
      )}

      {cancelTarget && (
        <ConfirmModal
          title="Cancel this gift order?"
          message={
            <>
              Cancels <strong>{cancelTarget.recipientName}</strong>&apos;s{' '}
              {OFF_PLATFORM_KIND_LABELS[cancelTarget.kind as OffPlatformKind] ?? cancelTarget.kind}
              {cancelReleasesNumber(cancelTarget.fulfillmentStatus) ? (
                <>
                  {' '}
                  and <strong>releases the edition number(s)</strong> back to available.
                </>
              ) : (
                <>
                  . The edition number <strong>stays consumed</strong>.
                </>
              )}
            </>
          }
          warning={
            modalError ? (
              <>⚠️ {modalError}</>
            ) : !cancelReleasesNumber(cancelTarget.fulfillmentStatus) ? (
              <>
                Production has already started, so a physical print carrying this number exists. The
                number is <strong>not</strong> returned to the pool — releasing it would let the
                same copy be sold again and two prints would share a number.
              </>
            ) : stageIndex(cancelTarget.fulfillmentStatus) >= 1 ? (
              <>
                This parcel is already <strong>at or past placement</strong> — only cancel if the
                print was never produced, or the freed number could be printed twice.
              </>
            ) : null
          }
          confirmLabel="Yes, cancel it"
          cancelLabel="Keep it"
          destructive
          busy={busyId === cancelTarget.id}
          onConfirm={handleCancel}
          onCancel={() => {
            if (busyId) return
            setCancelTarget(null)
            setModalError(null)
          }}
        />
      )}
    </DashboardLayout>
  )
}
