'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Input } from '@/components/ui/Input'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { daysSinceDelivered, PAYOUT_SAFE_WINDOW_DAYS } from '@/lib/orders/payoutPolicy'
import { formatEuro } from '@/lib/print-providers/format'

import {
  deleteOrder,
  getOrderDetail,
  markDelivered,
  markPaidManually,
  markPlaced,
  markRejected,
  markShipped,
  markStarted,
  refundOrder,
  releasePayout,
  type AdminOrderDetail as Detail,
} from '@/app/admin/orders/actions'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DOT_COLORS = {
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  grey: '#9ca3af',
} as const
type DotColor = keyof typeof DOT_COLORS

const Dot = ({ color }: { color: DotColor }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: DOT_COLORS[color],
      marginRight: 6,
      verticalAlign: 'middle',
    }}
  />
)

const TERMINAL_STAGES = new Set(['Complete', 'Rejected'])

// Full order lifecycle, rendered top-of-page as a trail of badges so
// the admin can see at a glance which milestones have been hit and
// which are still ahead. The first five steps are driven by
// `fulfillmentStatus`; the final "Artist paid" step is driven by
// `paidOutAt` (set when the artist payout — Stripe transfer or
// manual — has actually fired). Off-ramp `Rejected` is rendered
// separately, not as part of this trail.
const buildLifecycle = (order: { fulfillmentStatus: string | null; paidOutAt: string | null }) => {
  const fIdx = ['Placed', 'Started', 'Shipped', 'Complete'].indexOf(order.fulfillmentStatus ?? '')
  return [
    { label: 'New', reached: true },
    { label: 'At TPS', reached: fIdx >= 0 },
    { label: 'In production', reached: fIdx >= 1 },
    { label: 'Shipped', reached: fIdx >= 2 },
    { label: 'Delivered', reached: fIdx >= 3 },
    { label: 'Artist paid', reached: !!order.paidOutAt },
  ]
}

const CopyButton = ({ value, label }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={copied ? 'primary' : 'secondary'}
      size="small"
      font="dashboard"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      label={copied ? 'Copied' : (label ?? 'Copy')}
    />
  )
}

const eventDot = (kind: string): DotColor => {
  if (kind.endsWith('_failed') || kind === 'auth_canceled') return 'red'
  if (kind === 'captured' || kind === 'auth_received' || kind === 'email_sent') return 'green'
  if (kind === 'admin_action') return 'blue'
  return 'grey'
}

type Section = { title: string; rows: Array<[string, React.ReactNode]> }

export const AdminOrderDetail = ({ orderId }: { orderId: string }) => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [order, setOrder] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [busy, setBusy] = useState<'placed' | 'started' | 'shipped' | 'delivered' | null>(null)
  const [busyError, setBusyError] = useState<string | null>(null)
  const [shipOpen, setShipOpen] = useState(false)
  const [trackingUrlInput, setTrackingUrlInput] = useState('')

  const [payOpen, setPayOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualMethod, setManualMethod] = useState('')
  const [manualReference, setManualReference] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

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
    const res = await getOrderDetail(orderId)
    if (res.ok) setOrder(res.order)
    else setError(res.error)
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const handleRefund = useCallback(async () => {
    if (!order) return
    setRefunding(true)
    setRefundError(null)
    const res = await refundOrder(order.id, { reason: refundReason })
    if (!res.ok) {
      setRefundError(res.error)
      setRefunding(false)
      setRefundConfirmOpen(false)
      return
    }
    setRefundOpen(false)
    setRefundReason('')
    setRefunding(false)
    setRefundConfirmOpen(false)
    await load()
  }, [order, refundReason, load])

  const handleMarkRejected = useCallback(async () => {
    if (!order) return
    setRejecting(true)
    setRejectError(null)
    const res = await markRejected(order.id, rejectReason)
    setRejecting(false)
    if (!res.ok) {
      setRejectError(res.error)
      return
    }
    setRejectOpen(false)
    setRejectReason('')
    await load()
    if (res.needsRefund) setRefundOpen(true)
  }, [order, rejectReason, load])

  const handleDelete = useCallback(async () => {
    if (!order) return
    setDeleting(true)
    setDeleteError(null)
    const res = await deleteOrder(order.id)
    setDeleting(false)
    if (!res.ok) {
      setDeleteError(res.error)
      setDeleteConfirmOpen(false)
      return
    }
    router.push('/admin/orders')
  }, [order, router])

  const handlePlaced = useCallback(async () => {
    if (!order) return
    setBusy('placed')
    setBusyError(null)
    const res = await markPlaced(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handleStarted = useCallback(async () => {
    if (!order) return
    setBusy('started')
    setBusyError(null)
    const res = await markStarted(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handleShipped = useCallback(async () => {
    if (!order) return
    setBusy('shipped')
    setBusyError(null)
    const res = await markShipped(order.id, trackingUrlInput || null)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    setShipOpen(false)
    setTrackingUrlInput('')
    await load()
  }, [order, trackingUrlInput, load])

  const handleDelivered = useCallback(async () => {
    if (!order) return
    setBusy('delivered')
    setBusyError(null)
    const res = await markDelivered(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handlePayArtist = useCallback(async () => {
    if (!order) return
    setPaying(true)
    setPayError(null)
    const res = await releasePayout(order.id)
    setPaying(false)
    if (!res.ok) {
      setPayError(res.error)
      return
    }
    setPayOpen(false)
    await load()
  }, [order, load])

  const handleMarkPaidManually = useCallback(async () => {
    if (!order) return
    setManualSubmitting(true)
    setManualError(null)
    const res = await markPaidManually(order.id, {
      method: manualMethod,
      reference: manualReference,
      note: manualNote,
    })
    setManualSubmitting(false)
    if (!res.ok) {
      setManualError(res.error)
      return
    }
    setManualOpen(false)
    setManualMethod('')
    setManualReference('')
    setManualNote('')
    await load()
  }, [order, manualMethod, manualReference, manualNote, load])

  if (loading) {
    return (
      <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
        <p className={dashboardStyles.sectionDescription}>Loading…</p>
      </DashboardLayout>
    )
  }

  if (error || !order) {
    return (
      <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
        <p className={dashboardStyles.sectionDescription}>⚠️ {error ?? 'Order not found.'}</p>
      </DashboardLayout>
    )
  }

  const addr =
    (order.shippingAddress as {
      line1?: string
      line2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      phone?: string
    }) ?? {}

  const sections: Section[] = [
    {
      title: 'Buyer',
      rows: [
        ['Name', order.buyerName || '—'],
        ['Email', order.buyerEmail || '—'],
        ['Country', order.country],
        [
          'Shipping',
          <div key="ship" style={{ lineHeight: 1.5 }}>
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
            <br />
            {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
            <br />
            {addr.country}
            {addr.phone ? (
              <>
                <br />
                {addr.phone}
              </>
            ) : null}
          </div>,
        ],
      ],
    },
    {
      title: 'Artwork',
      rows: [
        [
          'Artwork',
          <>
            {order.artwork.title ?? order.artwork.slug ?? order.artwork.id}
            {' · '}
            <span style={{ opacity: 0.7 }}>{order.artist.name}</span>
          </>,
        ],
      ],
    },
    {
      title: 'Totals',
      rows: [
        ['Total paid by buyer', formatEuro(order.totalCents)],
        ['Artist cut', formatEuro(order.artistCents)],
        ['Gallery cut', formatEuro(order.galleryCents)],
        ['Production cost', formatEuro(order.productionCents)],
        ['Production shipping', formatEuro(order.productionShippingCents)],
        ['Customer VAT', formatEuro(order.customerVatCents)],
        ['Currency', order.currency.toUpperCase()],
      ],
    },
  ]

  const stage = order.fulfillmentStatus
  const isTerminal = stage ? TERMINAL_STAGES.has(stage) : false
  const canReject = !isTerminal

  return (
    <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 8 }}>
        {order.thumbnailUrl && (
          <img
            src={order.thumbnailUrl}
            alt={order.artwork.title ?? ''}
            style={{
              width: 96,
              height: 96,
              objectFit: 'contain',
              borderRadius: 4,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className={dashboardStyles.pageTitle} style={{ margin: 0 }}>
            Order #{order.id.slice(0, 8)}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            <strong>{order.artwork.title ?? '(untitled)'}</strong>
            <span style={{ opacity: 0.6 }}> — {order.artist.name}</span>
          </p>
          <p className={dashboardStyles.sectionDescription} style={{ margin: '4px 0 0 0' }}>
            Placed {formatDateTime(order.createdAt)} ·{' '}
            <Link href="/admin/orders">back to all orders</Link>
          </p>
        </div>
      </div>

      {order.fulfillmentStatus === 'Rejected' && order.paymentStatus === 'succeeded' && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              padding: '12px 16px',
              background: '#fdecea',
              border: '1px solid #f5a5a0',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>💸 Refund needed</p>
            <p style={{ margin: '0 0 8px 0' }}>
              This order is cancelled but the buyer&apos;s card was already charged{' '}
              <strong>{formatEuro(order.totalCents)}</strong>. Use the <strong>Refund buyer</strong>{' '}
              button below to return the money.
            </p>
          </div>
        </div>
      )}

      <div className={dashboardStyles.section}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Fulfillment</h2>
          {stage === 'Rejected' ? (
            <Badge label="Rejected" variant="past" />
          ) : (
            buildLifecycle(order).map((s) => (
              <Badge key={s.label} label={s.label} variant={s.reached ? 'current' : 'neutral'} />
            ))
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Single stage-aware primary CTA. The fulfillment pipeline
                is strictly forward-only — backward steps would just send
                contradictory emails to the buyer (the prior stage's
                email already went out and can't be unsent). At any
                moment there is exactly one "what to do next" button. */}
            {stage === null && order.paymentStatus === 'authorized' && (
              <Button
                font="dashboard"
                variant="primary"
                label={busy === 'placed' ? 'Capturing…' : 'Capture payment & mark placed'}
                onClick={handlePlaced}
                disabled={busy !== null}
              />
            )}
            {stage === 'Placed' && (
              <Button
                font="dashboard"
                variant="primary"
                label={busy === 'started' ? 'Marking…' : 'Mark in production (notify buyer)'}
                onClick={handleStarted}
                disabled={busy !== null}
              />
            )}
            {stage === 'Started' && (
              <Button
                font="dashboard"
                variant="primary"
                label={busy === 'shipped' ? 'Marking…' : 'Mark shipped (notify buyer)'}
                onClick={() => {
                  setBusyError(null)
                  setTrackingUrlInput(order.trackingUrl ?? '')
                  setShipOpen(true)
                }}
                disabled={busy !== null}
              />
            )}
            {stage === 'Shipped' && (
              <Button
                font="dashboard"
                variant="primary"
                label={busy === 'delivered' ? 'Marking…' : 'Mark delivered (notify buyer)'}
                onClick={handleDelivered}
                disabled={busy !== null}
              />
            )}
            {/* Off-ramp, available until terminal. Not a forward step in
                the pipeline — it pulls the order out of the flow
                entirely (and triggers refund-needed messaging if the
                card was already charged). */}
            {canReject && (
              <Button
                font="dashboard"
                variant="secondary"
                label="Mark rejected"
                onClick={() => {
                  setRejectError(null)
                  setRejectOpen(true)
                }}
                disabled={busy !== null}
              />
            )}
            {stage === null && order.paymentStatus !== 'authorized' && (
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                Waiting for payment to authorize before you can capture & mark placed.
              </span>
            )}
          </div>
          {busyError && <p style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>⚠️ {busyError}</p>}
          {shipOpen && (
            <div
              style={{
                padding: 16,
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 4,
                background: '#fafafa',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                <strong>Mark this order as shipped.</strong> Paste the tracking URL TPS provided so
                the buyer&apos;s email can link straight to it. Leave blank if you don&apos;t have
                one yet.
              </p>
              <label
                htmlFor="tracking-url"
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.7,
                }}
              >
                Tracking URL (optional)
              </label>
              <Input
                id="tracking-url"
                type="url"
                value={trackingUrlInput}
                onChange={(e) => setTrackingUrlInput(e.target.value)}
                placeholder="https://tracking.example.com/..."
                size="medium"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button
                  font="dashboard"
                  variant="primary"
                  label={busy === 'shipped' ? 'Marking…' : 'Mark shipped'}
                  onClick={handleShipped}
                  disabled={busy !== null}
                />
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Cancel"
                  onClick={() => {
                    setShipOpen(false)
                    setTrackingUrlInput('')
                    setBusyError(null)
                  }}
                  disabled={busy !== null}
                />
              </div>
            </div>
          )}
          {rejectOpen && (
            <div
              style={{
                padding: 16,
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 4,
                background: '#fafafa',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                <strong>Mark this order as rejected</strong>
                {order.paymentStatus === 'authorized'
                  ? ' — the Stripe hold will be voided immediately (no money moves).'
                  : order.paymentStatus === 'succeeded'
                    ? ' — the payment was already captured; after marking rejected you’ll need to issue a refund separately.'
                    : '.'}
              </p>
              <label
                htmlFor="reject-reason"
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.7,
                }}
              >
                Reason (internal, for audit log)
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. TPS rejected the file for low resolution."
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
              {rejectError && (
                <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                  ⚠️ {rejectError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button
                  font="dashboard"
                  variant="danger"
                  label={rejecting ? 'Marking…' : 'Mark rejected'}
                  onClick={handleMarkRejected}
                  disabled={rejecting || rejectReason.trim().length === 0}
                />
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Cancel"
                  onClick={() => {
                    setRejectOpen(false)
                    setRejectReason('')
                    setRejectError(null)
                  }}
                  disabled={rejecting}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pay the Artist — only surfaces once the order is delivered.
          Hidden once the artist has been paid (paidOutAt set, by either
          Stripe Connect transfer or out-of-band manual payment). The
          list page's Delivered-tab CTA navigates here so the admin
          sees full context before confirming a real money transfer. */}
      {order.fulfillmentStatus === 'Complete' && !order.paidOutAt && (
        <div className={dashboardStyles.section}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Pay the artist</h2>
          <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
            Release the artist&apos;s share to their connected Stripe account. Buyer&apos;s name and
            address are never shared.
          </p>

          {(() => {
            const days = daysSinceDelivered(order.shippedAt)
            const past = days !== null && days >= PAYOUT_SAFE_WINDOW_DAYS
            const remaining = days === null ? null : Math.max(0, PAYOUT_SAFE_WINDOW_DAYS - days)
            return (
              <div
                style={{
                  padding: '12px 14px',
                  background: past ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${past ? '#a7f3d0' : '#fde68a'}`,
                  borderRadius: 4,
                  fontSize: 13,
                  lineHeight: 1.55,
                  marginBottom: 16,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong>Amount to pay:</strong> {formatEuro(order.artistCents)} →{' '}
                  {order.artist.name}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Delivered:</strong>{' '}
                  {order.shippedAt ? formatDateTime(order.shippedAt) : 'unknown'}{' '}
                  {days !== null ? `(${days} day${days === 1 ? '' : 's'} ago)` : ''}
                </div>
                <div>
                  <strong>Safe window ({PAYOUT_SAFE_WINDOW_DAYS} days):</strong>{' '}
                  {past ? (
                    <span style={{ color: '#047857' }}>
                      ✓ Passed — paying now is low-risk for buyer disputes.
                    </span>
                  ) : (
                    <span style={{ color: '#b45309' }}>
                      ⚠ {remaining} day{remaining === 1 ? '' : 's'} remaining. Paying now is your
                      call — if the buyer disputes the order later, recovering the artist&apos;s
                      share will be on you.
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

          {!order.artist.stripeOnboardingComplete && (
            <p
              style={{
                margin: '0 0 16px 0',
                padding: '10px 14px',
                background: '#fdecea',
                border: '1px solid #f5a5a0',
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              ⚠️ <strong>Artist hasn&apos;t completed Stripe Connect onboarding.</strong> The
              transfer will fail. Ask {order.artist.name} to finish onboarding before you can pay
              them.
            </p>
          )}

          {payError && (
            <p style={{ margin: '0 0 12px 0', color: '#b91c1c', fontSize: 13 }}>⚠️ {payError}</p>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              font="dashboard"
              variant="primary"
              label={paying ? 'Paying…' : 'Pay with Stripe'}
              onClick={() => {
                setPayError(null)
                setPayOpen(true)
              }}
              disabled={paying || manualSubmitting || !order.artist.stripeOnboardingComplete}
            />
            <Button
              font="dashboard"
              variant="secondary"
              label="Pay manually"
              onClick={() => {
                setManualError(null)
                setManualOpen(true)
              }}
              disabled={paying || manualSubmitting}
            />
          </div>

          {manualOpen && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 4,
                background: '#fafafa',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontSize: 13, lineHeight: 1.5 }}>
                Use this if you paid {order.artist.name} outside Stripe Connect (e.g. SEPA from your
                bank, Wise, PayPal). The order will be marked paid and moved to Done — but no Stripe
                transfer happens. The artist is not auto-emailed; please notify them yourself.
              </p>

              <label
                htmlFor="manual-method"
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.7,
                }}
              >
                Method (e.g. SEPA, Wise, PayPal)
              </label>
              <div style={{ marginBottom: 12 }}>
                <Input
                  id="manual-method"
                  type="text"
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value)}
                  placeholder="SEPA"
                  size="medium"
                />
              </div>

              <label
                htmlFor="manual-reference"
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.7,
                }}
              >
                Reference (optional — bank transfer ID, etc.)
              </label>
              <div style={{ marginBottom: 12 }}>
                <Input
                  id="manual-reference"
                  type="text"
                  value={manualReference}
                  onChange={(e) => setManualReference(e.target.value)}
                  size="medium"
                />
              </div>

              <label
                htmlFor="manual-note"
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.7,
                }}
              >
                Note (optional)
              </label>
              <textarea
                id="manual-note"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                rows={2}
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

              {manualError && (
                <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                  ⚠️ {manualError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button
                  font="dashboard"
                  variant="primary"
                  label={
                    manualSubmitting ? 'Saving…' : `Mark paid (${formatEuro(order.artistCents)})`
                  }
                  onClick={handleMarkPaidManually}
                  disabled={manualSubmitting || manualMethod.trim().length === 0}
                />
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Cancel"
                  onClick={() => {
                    setManualOpen(false)
                    setManualMethod('')
                    setManualReference('')
                    setManualNote('')
                    setManualError(null)
                  }}
                  disabled={manualSubmitting}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal for the actual transfer. */}
      {payOpen && order && (
        <ConfirmModal
          title="Pay the artist?"
          message={
            <>
              This will transfer <strong>{formatEuro(order.artistCents)}</strong> to{' '}
              <strong>{order.artist.name}</strong>&apos;s Stripe account for order{' '}
              <code>#{order.id.slice(0, 8)}</code>. The order will then move into the Done tab.
              <br />
              <br />
              Once released, the money is on the artist&apos;s side — you can&apos;t pull it back
              from this dashboard.
            </>
          }
          warning={(() => {
            const days = daysSinceDelivered(order.shippedAt)
            if (days === null || days >= PAYOUT_SAFE_WINDOW_DAYS) return null
            return (
              <>
                Delivered <strong>{days}</strong> day{days === 1 ? '' : 's'} ago — only{' '}
                {PAYOUT_SAFE_WINDOW_DAYS - days} day
                {PAYOUT_SAFE_WINDOW_DAYS - days === 1 ? '' : 's'} into the {PAYOUT_SAFE_WINDOW_DAYS}
                -day safe window. If the buyer disputes this order later, recovering the
                artist&apos;s share will be on you.
              </>
            )
          })()}
          confirmLabel="Yes, pay the artist"
          cancelLabel="Cancel"
          destructive
          busy={paying}
          onConfirm={handlePayArtist}
          onCancel={() => setPayOpen(false)}
        />
      )}

      <div className={dashboardStyles.section}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>For TPS placement</h2>
        <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
          Paste these into theprintspace&apos;s &ldquo;Order Prints&rdquo; form.
        </p>

        {order.specs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.6,
                marginBottom: 4,
              }}
            >
              Specs
            </div>
            <table style={{ fontSize: 13 }}>
              <tbody>
                {order.specs.map((s) => (
                  <tr key={s.label}>
                    <td style={{ padding: '2px 16px 2px 0', opacity: 0.7 }}>{s.label}</td>
                    <td style={{ padding: '2px 0', fontFamily: 'monospace' }}>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.6,
              marginBottom: 4,
            }}
          >
            Recipient
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {order.buyerName}
              <br />
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ''}
              <br />
              {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
              <br />
              {addr.country}
              {addr.phone ? (
                <>
                  <br />
                  {addr.phone}
                </>
              ) : null}
            </div>
            <CopyButton
              value={[
                order.buyerName,
                [addr.line1, addr.line2].filter(Boolean).join(', '),
                [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
                addr.country,
                addr.phone,
              ]
                .filter(Boolean)
                .join('\n')}
              label="Copy address"
            />
          </div>
        </div>

        {order.assetUrl && (
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.6,
                marginBottom: 4,
              }}
            >
              Print asset
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <a
                href={order.assetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12 }}
              >
                Open original
              </a>
            </div>
          </div>
        )}

        {order.certificateUrl && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.6,
                marginBottom: 4,
              }}
            >
              Certificate of authenticity
            </div>
            <a
              href={order.certificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12 }}
            >
              Open PDF
            </a>
          </div>
        )}
      </div>

      {(() => {
        const refundable =
          order.paymentStatus === 'authorized' || order.paymentStatus === 'succeeded'
        const alreadyRefunded = order.paymentStatus === 'refunded'
        return (
          <div className={dashboardStyles.section}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {!refundOpen && refundable && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label={`Refund buyer (${formatEuro(order.totalCents)})`}
                  onClick={() => setRefundOpen(true)}
                />
              )}
              {alreadyRefunded && <Badge label="Refunded" variant="unpublished" />}
              {!refundable && !alreadyRefunded && (
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
                  Not refundable in current state ({order.paymentStatus}).
                </span>
              )}
            </div>

            {refundOpen && (
              <div
                style={{
                  marginTop: 12,
                  padding: 16,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 4,
                  background: '#fafafa',
                }}
              >
                <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                  <strong>Refund {formatEuro(order.totalCents)} to the buyer</strong>
                  {order.paymentStatus === 'authorized'
                    ? ' — no money has been charged yet; this releases the hold on their card.'
                    : ' — this returns the money from our Stripe balance to the buyer’s card. Takes 5–10 business days to appear on their statement.'}
                </p>

                {order.paidOutAt && (
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      padding: 10,
                      background: '#fff4cc',
                      border: '1px solid #e9c46a',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    ⚠️ <strong>Artist payout already released</strong> (
                    {formatEuro(order.artistCents)}
                    {order.transferId ? ' via Stripe' : ' manually'}). Refunding here will{' '}
                    <em>not</em> claw that back — you&apos;ll need to recover it from the artist
                    separately.
                  </p>
                )}

                <label
                  htmlFor="refund-reason"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.7,
                  }}
                >
                  Reason (internal, for audit log)
                </label>
                <textarea
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Buyer reported damaged frame, photos provided."
                />

                {refundError && (
                  <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                    ⚠️ {refundError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button
                    font="dashboard"
                    variant="danger"
                    label="Issue refund"
                    onClick={() => setRefundConfirmOpen(true)}
                    disabled={refunding || refundReason.trim().length === 0}
                  />
                  <Button
                    font="dashboard"
                    variant="secondary"
                    label="Cancel"
                    onClick={() => {
                      setRefundOpen(false)
                      setRefundReason('')
                      setRefundError(null)
                    }}
                    disabled={refunding}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {sections.map((s) => (
        <div key={s.title} className={dashboardStyles.section}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>{s.title}</h2>
          <table className={dashboardStyles.table}>
            <tbody>
              {s.rows.map(([k, v], i) => (
                <tr key={i}>
                  <td style={{ width: 220, opacity: 0.7, verticalAlign: 'top' }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {refundConfirmOpen && (
        <ConfirmModal
          title="Refund the buyer?"
          message={
            <>
              This will refund <strong>{formatEuro(order.totalCents)}</strong> to{' '}
              <strong>{order.buyerName || order.buyerEmail}</strong> for order{' '}
              <code>#{order.id.slice(0, 8)}</code>.
              <br />
              <br />
              {order.paymentStatus === 'authorized'
                ? 'No money has been charged yet — this releases the hold on their card.'
                : 'The money will be returned from your Stripe balance to the buyer’s card. Stripe fees from the original charge are not refunded.'}
            </>
          }
          warning={
            order.paidOutAt ? (
              <>
                <strong>Artist payout already released</strong> ({formatEuro(order.artistCents)}
                {order.transferId ? ' via Stripe' : ' manually'}). This refund will not claw that
                back — you&apos;ll need to recover it from the artist separately.
              </>
            ) : null
          }
          confirmLabel="Yes, refund buyer"
          cancelLabel="Go back"
          destructive
          busy={refunding}
          onConfirm={handleRefund}
          onCancel={() => setRefundConfirmOpen(false)}
        />
      )}

      <div className={dashboardStyles.section}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Event timeline</h2>
        {order.events.length === 0 ? (
          <p className={dashboardStyles.sectionDescription}>No events recorded yet.</p>
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>When</th>
                <th>Kind</th>
                <th>Actor</th>
                <th>Message</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {order.events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Dot color={eventDot(e.kind)} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</td>
                  <td>
                    <code style={{ fontSize: 'var(--text-xs)' }}>{e.kind}</code>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{e.actor}</td>
                  <td>{e.message ?? '—'}</td>
                  <td>
                    {e.payload ? (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                          view
                        </summary>
                        <pre
                          style={{
                            fontSize: 11,
                            background: '#f8f8f8',
                            padding: 8,
                            overflow: 'auto',
                            maxWidth: 480,
                          }}
                        >
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={dashboardStyles.section}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Danger zone</h2>
        <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
          Permanently delete this order and its event history. Refunds and payout reversals are
          handled separately — this only removes the order row.
        </p>
        {deleteError && (
          <p style={{ margin: '0 0 12px 0', color: '#b91c1c', fontSize: 13 }}>⚠️ {deleteError}</p>
        )}
        <Button
          font="dashboard"
          variant="danger"
          label="Delete order"
          onClick={() => {
            setDeleteError(null)
            setDeleteConfirmOpen(true)
          }}
        />
      </div>

      {deleteConfirmOpen && (
        <ConfirmModal
          title="Delete this order?"
          message={
            <>
              This will <strong>permanently remove</strong> order{' '}
              <code>#{order.id.slice(0, 8)}</code> and its entire event history from the database.
              {order.paymentStatus === 'authorized' && (
                <>
                  <br />
                  <br />
                  The Stripe card hold ({formatEuro(order.totalCents)}) will be cancelled
                  best-effort, releasing the funds back to the buyer&apos;s card.
                </>
              )}
            </>
          }
          warning="This cannot be undone."
          confirmLabel="Yes, delete permanently"
          cancelLabel="Keep order"
          destructive
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </DashboardLayout>
  )
}
