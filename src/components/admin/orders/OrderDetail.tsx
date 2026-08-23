'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Input } from '@/components/ui/Input'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { editionTypeLabel } from '@/lib/editions/editionLabel'
import { AUTHORIZATION_LIFETIME_DAYS, authorizationHold } from '@/lib/orders/authorizationPolicy'
import { daysSinceDelivered, PAYOUT_SAFE_WINDOW_DAYS } from '@/lib/orders/payoutPolicy'
import { formatEuro } from '@/lib/print-providers/format'
import { countryName } from '@/utils/countryName'

import {
  deleteOrder,
  getOrderDetail,
  markDelivered,
  markItemPaidManually,
  markPaidManually,
  capturePayment,
  markPlacedAtTps,
  cancelOrder,
  markShipped,
  markStarted,
  refundOrder,
  reorderForReprint,
  releaseItemPayout,
  releasePayout,
  sendInvoice,
  issueCreditNote,
  type AdminOrderDetail as Detail,
  type AdminOrderItem,
} from '@/app/admin/orders/actions'
import { REORDER_REASONS, REORDER_REASON_LABELS } from '@/lib/orders/reorderReasons'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { formatOrderRef } from '@/lib/orders/orderRef'

// Order hard-delete is a dev/staging cleanup tool only — in production the
// Danger zone does not render (and the server action refuses regardless).
const DEV_CLEANUP_ALLOWED = process.env.NEXT_PUBLIC_APP_ENV !== 'production'

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
  gray: '#9ca3af',
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

// Shared issue banner — matches the existing "💸 Refund needed" box so
// every must-not-miss order state reads the same way: a bold title, a
// plain-language explanation, and the action (if any).
const IssueBanner = ({
  tone,
  title,
  children,
}: {
  tone: 'red' | 'amber'
  title: string
  children: ReactNode
}) => {
  const palette =
    tone === 'red' ? { bg: '#fdecea', border: '#f5a5a0' } : { bg: '#fef3c7', border: '#fcd34d' }
  return (
    <div className={dashboardStyles.section}>
      <div
        style={{
          padding: '12px 16px',
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          borderRadius: 4,
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>{title}</p>
        <div style={{ margin: 0 }}>{children}</div>
      </div>
    </div>
  )
}

const TERMINAL_STAGES = new Set(['Complete', 'Cancelled'])

// Full order lifecycle, rendered top-of-page as a trail of badges so
// the admin can see at a glance which milestones have been hit and
// which are still ahead. The first five steps are driven by
// `fulfillmentStatus`; the final "Artist paid" step is driven by
// `paidOutAt` (set when the artist payout — Stripe transfer or
// manual — has actually fired). Off-ramp `Cancelled` is rendered
// separately, not as part of this trail.
const buildLifecycle = (order: {
  fulfillmentStatus: string | null
  paidOutAt: string | null
  isCart: boolean
  items: AdminOrderItem[]
}) => {
  const fIdx = ['Placed', 'Started', 'Shipped', 'Complete'].indexOf(order.fulfillmentStatus ?? '')
  // Cart orders pay per item — "Artist paid" is reached only when every line
  // is paid (header paidOutAt is never stamped for carts). Legacy single-print
  // orders use the header paidOutAt as before.
  // A reversed (clawed-back) line keeps its stale paidOutAt, so don't count it
  // as paid — otherwise a refunded order could still show "Artists paid".
  const paidReached = order.isCart
    ? order.items.length > 0 &&
      order.items.every((it) => !!it.paidOutAt && it.transferStatus !== 'reversed')
    : !!order.paidOutAt
  return [
    { label: 'New', reached: true },
    { label: 'At TPS', reached: fIdx >= 0 },
    { label: 'In production', reached: fIdx >= 1 },
    { label: 'Shipped', reached: fIdx >= 2 },
    { label: 'Delivered', reached: fIdx >= 3 },
    { label: order.isCart ? 'Artists paid' : 'Artist paid', reached: paidReached },
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
  if (
    kind === 'captured' ||
    kind === 'auth_received' ||
    kind === 'email_sent' ||
    kind === 'payout_released'
  )
    return 'green'
  if (kind === 'admin_action') return 'blue'
  return 'gray'
}

// Per-line payout status pill for cart orders. Cart orders pay each
// artist independently (per-item Stripe Connect transfer), so each line
// carries its own payout state.
const ItemPayoutStatus = ({ item }: { item: AdminOrderItem }) => {
  // A clawed-back line keeps its (stale) paidOutAt, so check 'reversed' FIRST —
  // otherwise the paidOutAt branch would render it as still 'Paid' on a refunded
  // order, which is misleading. The reversal date is on the order's event log.
  if (item.transferStatus === 'reversed') {
    return (
      <span style={{ fontSize: 'var(--text-xs)' }}>
        <Dot color="red" />
        Reversed (refunded)
      </span>
    )
  }
  if (item.paidOutAt) {
    const isManual = item.transferStatus === 'paid_manual'
    return (
      <span style={{ fontSize: 'var(--text-xs)' }}>
        <Dot color="green" />
        Paid {formatDateTime(item.paidOutAt)}
        {isManual ? ' (manual)' : ''}
      </span>
    )
  }
  return (
    <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
      <Dot color="gray" />
      Not paid
    </span>
  )
}

// Line-items table for cart (multi-item) orders. Authoritative per-line
// data comes from PrintOrderItem (money, payout, edition numbers); the
// header columns are deprecated rollups. Legacy single-print orders never
// render this — they use the single artwork/config blocks instead.
const LineItemsTable = ({ items }: { items: AdminOrderItem[] }) => (
  <table className={dashboardStyles.table}>
    <thead>
      <tr>
        <th>Artwork</th>
        <th>Specs</th>
        <th>Qty</th>
        <th>Editions</th>
        <th>TPS</th>
        <th>Artist cut</th>
        <th>Gallery cut</th>
        <th>Payout</th>
      </tr>
    </thead>
    <tbody>
      {items.map((it) => (
        <tr key={it.id}>
          <td>
            <div>{it.artworkTitle}</div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>
              {it.artistName}
            </div>
            {it.editionName && (
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>
                <div>{editionTypeLabel('limited')}</div>
                <div>{it.editionName}</div>
              </div>
            )}
          </td>
          <td style={{ fontSize: 'var(--text-xs)' }}>
            {it.specsSummary.length > 0
              ? it.specsSummary.map((s) => (
                  <div key={s.id}>
                    <span style={{ opacity: 0.6 }}>{s.label}:</span> {s.value}
                  </div>
                ))
              : '—'}
          </td>
          <td>{it.quantity}</td>
          <td style={{ fontSize: 'var(--text-xs)' }}>
            {it.editionLabels.length > 0 ? it.editionLabels.join(', ') : '—'}
          </td>
          <td style={{ whiteSpace: 'nowrap' }}>{formatEuro(it.productionCents)}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{formatEuro(it.artistCents)}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{formatEuro(it.galleryCents)}</td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <ItemPayoutStatus item={it} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)

// Per-item payout control for cart orders. Cart orders pay each artist
// independently (one Stripe Connect transfer per line), so an order can be
// partly paid out. Each line carries its own confirm-modal + manual-payout
// form state, mirroring the header payout block's flow. Only rendered when
// the parent order is delivered (Complete). The server actions re-check the
// onboarding / Complete / no-double-pay guards and surface any failure here.
const ItemPayout = ({ item, onDone }: { item: AdminOrderItem; onDone: () => Promise<void> }) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const handleStripe = useCallback(async () => {
    setPaying(true)
    setError(null)
    const res = await releaseItemPayout(item.id)
    setPaying(false)
    if (!res.ok) {
      setError(res.error)
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    await onDone()
  }, [item.id, onDone])

  const handleManual = useCallback(async () => {
    setManualSubmitting(true)
    setManualError(null)
    const res = await markItemPaidManually(item.id, { method, reference, note })
    setManualSubmitting(false)
    if (!res.ok) {
      setManualError(res.error)
      return
    }
    setManualOpen(false)
    setMethod('')
    setReference('')
    setNote('')
    await onDone()
  }, [item.id, method, reference, note, onDone])

  if (item.paidOutAt) {
    return <ItemPayoutStatus item={item} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          font="dashboard"
          variant="primary"
          size="small"
          label={paying ? 'Paying…' : `Pay ${formatEuro(item.artistCents)} with Stripe`}
          onClick={() => {
            setError(null)
            setConfirmOpen(true)
          }}
          disabled={paying || manualSubmitting}
        />
        <Button
          font="dashboard"
          variant="secondary"
          size="small"
          label="Pay manually"
          onClick={() => {
            setManualError(null)
            setManualOpen(true)
          }}
          disabled={paying || manualSubmitting}
        />
      </div>
      {error && <span style={{ color: '#b91c1c', fontSize: 'var(--text-xs)' }}>⚠️ {error}</span>}

      {manualOpen && (
        <div
          style={{
            padding: 12,
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 4,
            background: '#fafafa',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
            Record an off-Stripe payment to {item.artistName} ({formatEuro(item.artistCents)}). No
            Stripe transfer happens; the artist is not auto-emailed.
          </p>
          <div style={{ marginBottom: 8 }}>
            <Input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Method (SEPA, Wise, …)"
              size="medium"
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <Input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Reference (optional)"
              size="medium"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note (optional)"
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
            <p style={{ margin: '8px 0 0 0', color: '#b91c1c', fontSize: 'var(--text-xs)' }}>
              ⚠️ {manualError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button
              font="dashboard"
              variant="primary"
              size="small"
              label={manualSubmitting ? 'Saving…' : `Mark paid (${formatEuro(item.artistCents)})`}
              onClick={handleManual}
              disabled={manualSubmitting || method.trim().length === 0}
            />
            <Button
              font="dashboard"
              variant="secondary"
              size="small"
              label="Cancel"
              onClick={() => {
                setManualOpen(false)
                setMethod('')
                setReference('')
                setNote('')
                setManualError(null)
              }}
              disabled={manualSubmitting}
            />
          </div>
        </div>
      )}

      {confirmOpen && (
        <ConfirmModal
          title="Pay this artist?"
          message={
            <>
              This will transfer <strong>{formatEuro(item.artistCents)}</strong> to{' '}
              <strong>{item.artistName}</strong>&apos;s Stripe account for{' '}
              <strong>{item.artworkTitle}</strong>.
              <br />
              <br />
              Once released, the money is on the artist&apos;s side — you can&apos;t pull it back
              from this dashboard.
            </>
          }
          confirmLabel="Yes, pay this artist"
          cancelLabel="Cancel"
          destructive
          busy={paying}
          onConfirm={handleStripe}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
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

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [reorderOpen, setReorderOpen] = useState(false)
  const [reorderReason, setReorderReason] = useState('')
  const [reorderNote, setReorderNote] = useState('')
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [busy, setBusy] = useState<
    'capture' | 'placed' | 'started' | 'shipped' | 'delivered' | null
  >(null)
  const [busyError, setBusyError] = useState<string | null>(null)
  const [shipOpen, setShipOpen] = useState(false)
  const [trackingUrlInput, setTrackingUrlInput] = useState('')

  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  const [creditNoteConfirmOpen, setCreditNoteConfirmOpen] = useState(false)
  const [creditNoteReason, setCreditNoteReason] = useState('')
  const [issuingCreditNote, setIssuingCreditNote] = useState(false)
  const [creditNoteError, setCreditNoteError] = useState<string | null>(null)

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

  const handleCancelOrder = useCallback(async () => {
    if (!order) return
    setCanceling(true)
    setCancelError(null)
    const res = await cancelOrder(order.id, cancelReason)
    setCanceling(false)
    if (!res.ok) {
      setCancelError(res.error)
      return
    }
    setCancelOpen(false)
    setCancelReason('')
    await load()
    if (res.needsRefund) setRefundOpen(true)
  }, [order, cancelReason, load])

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

  const handleCapture = useCallback(async () => {
    if (!order) return
    setBusy('capture')
    setBusyError(null)
    const res = await capturePayment(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handlePlacedAtTps = useCallback(async () => {
    if (!order) return
    setBusy('placed')
    setBusyError(null)
    const res = await markPlacedAtTps(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handleReorder = useCallback(async () => {
    if (!order) return
    setReordering(true)
    setReorderError(null)
    const res = await reorderForReprint(order.id, { reason: reorderReason, note: reorderNote })
    setReordering(false)
    if (!res.ok) {
      setReorderError(res.error)
      return
    }
    setReorderOpen(false)
    setReorderReason('')
    setReorderNote('')
    await load()
  }, [order, reorderReason, reorderNote, load])

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

  const handleSendInvoice = useCallback(async () => {
    if (!order) return
    setSendingInvoice(true)
    setInvoiceError(null)
    const res = await sendInvoice(order.id)
    setSendingInvoice(false)
    setInvoiceConfirmOpen(false)
    if (!res.ok) {
      setInvoiceError(res.error)
      // Reload even on failure: per the number-burn rule the invoice row may
      // already be committed (render/email failed after minting) — the UI
      // must flip to the "invoice exists / re-send" state, not keep offering
      // a first issue.
      await load()
      return
    }
    if (!res.emailed) {
      setInvoiceError(
        `Invoice ${res.number} was issued and archived, but the EMAIL FAILED — the buyer has NOT received it. Use "Send invoice again" to retry.`,
      )
    }
    await load()
  }, [order, load])

  const handleIssueCreditNote = useCallback(async () => {
    if (!order) return
    setIssuingCreditNote(true)
    setCreditNoteError(null)
    const res = await issueCreditNote(order.id, creditNoteReason || undefined)
    setIssuingCreditNote(false)
    setCreditNoteConfirmOpen(false)
    if (!res.ok) {
      setCreditNoteError(res.error)
      // Same number-burn rule as invoices — reload so a committed credit
      // note shows up even when render/email failed.
      await load()
      return
    }
    if (!res.emailed) {
      setCreditNoteError(
        `Credit note ${res.number} was issued and archived, but the EMAIL FAILED — the buyer has NOT received it. Use "Send credit note again" to retry.`,
      )
    }
    setCreditNoteReason('')
    await load()
  }, [order, creditNoteReason, load])

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

  // Cart orders store the buyer's ShippingAddress verbatim (address1 /
  // address2 / stateOrRegion / countryCode); single-print orders store Stripe's
  // shape (line1 / line2 / state / country). Read BOTH so the street + country
  // never go blank regardless of which path created the order.
  const rawAddr = (order.shippingAddress as Record<string, unknown> | null) ?? {}
  const addr = {
    line1: (rawAddr.line1 ?? rawAddr.address1) as string | undefined,
    line2: (rawAddr.line2 ?? rawAddr.address2) as string | undefined,
    city: rawAddr.city as string | undefined,
    state: (rawAddr.state ?? rawAddr.stateOrRegion) as string | undefined,
    postalCode: rawAddr.postalCode as string | undefined,
    country: (rawAddr.country ?? rawAddr.countryCode) as string | undefined,
    phone: rawAddr.phone as string | undefined,
  }

  const sections: Section[] = [
    {
      title: 'Buyer',
      rows: [
        ['Name', order.buyerName || '—'],
        ['Email', order.buyerEmail || '—'],
        ['Country', countryName(order.country) || '—'],
        [
          'Shipping',
          <div key="ship" style={{ lineHeight: 1.5 }}>
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
            <br />
            {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
            <br />
            {countryName(addr.country)}
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
    // Cart orders render a dedicated line-items table below instead of this
    // single-artwork row; legacy single-print orders keep it.
    ...(order.isCart
      ? []
      : [
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
            ] as Array<[string, React.ReactNode]>,
          },
        ]),
    {
      title: 'Totals',
      // For cart orders the per-cut amounts (artist/gallery/production) are
      // deprecated header rollups whose authority lives on each line — they're
      // already shown per-line in the Items table, so we omit them here to
      // avoid showing the same money three times and only list true
      // order-level totals. Legacy single-print orders keep the full
      // breakdown (the header IS the authoritative source there).
      rows: order.isCart
        ? ([
            ['Total paid by buyer', formatEuro(order.totalCents)],
            ['Production shipping', formatEuro(order.productionShippingCents)],
            ['Customer VAT', formatEuro(order.customerVatCents)],
            ['Currency', order.currency.toUpperCase()],
          ] as Array<[string, React.ReactNode]>)
        : ([
            ['Total paid by buyer', formatEuro(order.totalCents)],
            ['Artist cut', formatEuro(order.artistCents)],
            ['Gallery cut', formatEuro(order.galleryCents)],
            ['Production cost', formatEuro(order.productionCents)],
            ['Production shipping', formatEuro(order.productionShippingCents)],
            ['Customer VAT', formatEuro(order.customerVatCents)],
            ['Currency', order.currency.toUpperCase()],
          ] as Array<[string, React.ReactNode]>),
    },
  ]

  const stage = order.fulfillmentStatus
  const isTerminal = stage ? TERMINAL_STAGES.has(stage) : false
  const canCancel = !isTerminal
  // A refunded or canceled order is terminal & READ-ONLY: no fulfillment
  // actions at all (advancing one would, e.g., email an already-refunded buyer
  // "in production"). The "Delete order" escape hatch in the Danger zone is
  // exempt — it stays available in every state.
  const isTerminalPayment = order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled'

  // Silent-failure states that need an explicit explanation. A `canceled`
  // order with no fulfillment stage was never a deliberate dashboard
  // cancel (that sets fulfillmentStatus='Cancelled') — it's an expired or
  // externally-canceled auth, i.e. a lost sale. `failed` is a declined card.
  const isAuthExpired = order.paymentStatus === 'canceled' && order.fulfillmentStatus === null
  const isPaymentFailed = order.paymentStatus === 'failed'

  // Proactive warning as the auth window closes (or has lapsed) on a
  // still-authorized, unplaced order — capture before the sale is lost. The
  // countdown itself comes from authorizationPolicy, which the orders list and
  // the reconcile cron's daily warning also read, so the three cannot drift
  // apart on either the lifetime or the day it starts warning.
  const hold = order.fulfillmentStatus === null ? authorizationHold(order) : null
  const authExpiresAt = hold
    ? new Date(new Date(order.createdAt).getTime() + AUTHORIZATION_LIFETIME_DAYS * 86_400_000)
    : null
  const authExpiringSoon = hold !== null && hold.status !== 'fresh'

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
            Order {formatOrderRef(order.id)}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            {order.isCart ? (
              <strong>
                {order.items.length} {order.items.length === 1 ? 'print' : 'prints'}
              </strong>
            ) : (
              <>
                <strong>{order.artwork.title ?? '(untitled)'}</strong>
                <span style={{ opacity: 0.6 }}> — {order.artist.name}</span>
              </>
            )}
          </p>
          {order.reorderCount > 0 && (
            <p style={{ margin: '6px 0 0 0', fontSize: 13 }}>
              <Badge
                label={`⟳ Replacement${order.reorderCount > 1 ? ` ×${order.reorderCount}` : ''}`}
                variant="unpublished"
              />
              {order.reorderReason && (
                <span style={{ opacity: 0.75 }}>
                  {' '}
                  —{' '}
                  {REORDER_REASON_LABELS[
                    order.reorderReason as keyof typeof REORDER_REASON_LABELS
                  ] ?? order.reorderReason}
                </span>
              )}
              {order.reorderNote && <span style={{ opacity: 0.6 }}> · “{order.reorderNote}”</span>}
              {order.reorderedAt && (
                <span style={{ opacity: 0.6 }}> · {formatDateTime(order.reorderedAt)}</span>
              )}
            </p>
          )}
          <p className={dashboardStyles.sectionDescription} style={{ margin: '4px 0 0 0' }}>
            Placed {formatDateTime(order.createdAt)} ·{' '}
            <Link href="/admin/orders">back to all orders</Link>
          </p>
        </div>
      </div>

      {isTerminalPayment && !isAuthExpired && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              padding: '12px 16px',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            This order is {order.paymentStatus} — view only. No further action is needed.
          </div>
        </div>
      )}

      {isAuthExpired && (
        <IssueBanner tone="red" title="⚠️ Authorization expired — no payment collected">
          The buyer&apos;s card hold lapsed before the payment was captured, so{' '}
          <strong>no money was taken</strong> and there is nothing to fulfill. If they still want
          the print, they&apos;ll need to purchase again. You can remove this order from the Danger
          zone below.
        </IssueBanner>
      )}

      {isPaymentFailed && (
        <IssueBanner tone="red" title="⛔ Payment failed — card declined">
          The buyer&apos;s card was declined, so <strong>no money was taken</strong> and there is
          nothing to fulfill. No action is required unless you want to follow up. You can remove
          this order from the Danger zone below.
        </IssueBanner>
      )}

      {authExpiringSoon && authExpiresAt && (
        <IssueBanner
          tone="amber"
          title={
            authExpiresAt.getTime() <= Date.now()
              ? '⏳ Authorization may have expired'
              : '⏳ Authorization expires soon'
          }
        >
          Stripe holds the buyer&apos;s card for about {AUTHORIZATION_LIFETIME_DAYS} days. This hold{' '}
          {authExpiresAt.getTime() <= Date.now() ? 'was expected to lapse' : 'lapses'} around{' '}
          <strong>{formatDateTime(authExpiresAt.toISOString())}</strong>. Capture the payment
          (button below) before then or the sale — <strong>{formatEuro(order.totalCents)}</strong> —
          is lost.
        </IssueBanner>
      )}

      {order.fulfillmentStatus === 'Cancelled' && order.paymentStatus === 'succeeded' && (
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
              This order is canceled but the buyer&apos;s card was already charged{' '}
              <strong>{formatEuro(order.totalCents)}</strong>. Use the <strong>Refund buyer</strong>{' '}
              button below to return the money.
            </p>
          </div>
        </div>
      )}

      {order.isCart && (
        <div className={dashboardStyles.section}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>
            Items ({order.items.length} {order.items.length === 1 ? 'print' : 'prints'})
          </h2>
          <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 12px 0' }}>
            Per-line money and payout status are authoritative for cart orders. Each artist is paid
            independently.
          </p>
          <LineItemsTable items={order.items} />
        </div>
      )}

      {/* Per-item payouts for cart orders — surfaces once the order is
          delivered (Complete), mirroring the header "Pay the artist" block.
          Each line is paid independently (mixed-artist carts), so the order
          can be "partly paid out". The header-level Pay-the-artist block
          below is hidden for cart orders (it would pay the wrong, rolled-up
          amount to the first artist only). */}
      {order.isCart && order.fulfillmentStatus === 'Complete' && (
        <div className={dashboardStyles.section}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Pay the artists</h2>
          {(() => {
            const paidCount = order.items.filter(
              (it) => it.paidOutAt && it.transferStatus !== 'reversed',
            ).length
            const allPaid = paidCount === order.items.length
            const partly = paidCount > 0 && !allPaid
            return (
              <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
                Each artist is paid independently to their connected Stripe account.{' '}
                {allPaid ? (
                  <strong style={{ color: '#047857' }}>
                    All {order.items.length} items paid out.
                  </strong>
                ) : partly ? (
                  <strong style={{ color: '#b45309' }}>
                    Partly paid out — {paidCount} of {order.items.length} items paid.
                  </strong>
                ) : (
                  <span>None paid out yet.</span>
                )}
              </p>
            )
          })()}
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Artwork</th>
                <th>Artist</th>
                <th style={{ textAlign: 'right' }}>Artist cut</th>
                <th>Payout</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.artworkTitle}</td>
                  <td>{it.artistName}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatEuro(it.artistCents)}
                  </td>
                  <td>
                    <ItemPayout item={it} onDone={load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          {stage === 'Cancelled' ? (
            <Badge label="Canceled" variant="past" />
          ) : (
            buildLifecycle(order).map((s) => (
              <Badge key={s.label} label={s.label} variant={s.reached ? 'current' : 'neutral'} />
            ))
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {isTerminalPayment ? (
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                This order is {order.paymentStatus} — no further actions (view only).
              </span>
            ) : (
              <>
                {/* Single stage-aware primary CTA. The fulfillment pipeline
                is strictly forward-only — backward steps would just send
                contradictory emails to the buyer (the prior stage's
                email already went out and can't be unsent). At any
                moment there is exactly one "what to do next" button. */}
                {stage === null && order.paymentStatus === 'authorized' && (
                  <Button
                    font="dashboard"
                    variant="primary"
                    label={busy === 'capture' ? 'Capturing…' : 'Capture payment'}
                    onClick={handleCapture}
                    disabled={busy !== null}
                  />
                )}
                {stage === null && order.paymentStatus === 'succeeded' && (
                  <Button
                    font="dashboard"
                    variant="primary"
                    label={busy === 'placed' ? 'Marking…' : 'Mark placed at TPS'}
                    onClick={handlePlacedAtTps}
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
                {canCancel && (
                  <Button
                    font="dashboard"
                    variant="secondary"
                    label="Cancel order"
                    onClick={() => {
                      setCancelError(null)
                      setCancelOpen(true)
                    }}
                    disabled={busy !== null}
                  />
                )}
                {stage === null &&
                  order.paymentStatus !== 'authorized' &&
                  order.paymentStatus !== 'succeeded' && (
                    <span style={{ fontSize: 12, opacity: 0.6 }}>
                      Waiting for payment to authorize before you can capture.
                    </span>
                  )}
              </>
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
          {cancelOpen && (
            <div
              style={{
                padding: 16,
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 4,
                background: '#fafafa',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                <strong>Cancel this order</strong>
                {order.paymentStatus === 'authorized'
                  ? ' — the Stripe hold will be voided immediately (no money moves).'
                  : order.paymentStatus === 'succeeded'
                    ? ' — the payment was already captured; after canceling you’ll need to issue a refund separately.'
                    : '.'}
              </p>
              <label
                htmlFor="cancel-reason"
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
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="e.g. Buyer asked to cancel; or TPS rejected the file for low resolution."
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
              {cancelError && (
                <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                  ⚠️ {cancelError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button
                  font="dashboard"
                  variant="danger"
                  label={canceling ? 'Canceling…' : 'Cancel order'}
                  onClick={handleCancelOrder}
                  disabled={canceling || cancelReason.trim().length === 0}
                />
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Keep order"
                  onClick={() => {
                    setCancelOpen(false)
                    setCancelReason('')
                    setCancelError(null)
                  }}
                  disabled={canceling}
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
      {!order.isCart && order.fulfillmentStatus === 'Complete' && !order.paidOutAt && (
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
              <code>{formatOrderRef(order.id)}</code>. The order will then move into the Done tab.
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

        {/* Cart orders: one specs block per line (each is its own TPS order).
            Legacy single-print orders: the single header-derived specs block. */}
        {order.isCart
          ? order.items.map((it) => (
              <div key={it.id} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.85,
                    marginBottom: 6,
                  }}
                >
                  {it.artworkTitle} · {it.artistName}
                  {it.quantity > 1 ? ` · ×${it.quantity}` : ''}
                </div>
                {it.specsSummary.length > 0 ? (
                  <table style={{ fontSize: 13 }}>
                    <tbody>
                      {it.editionLabels.length > 0 && (
                        <tr>
                          <td style={{ padding: '2px 16px 2px 0', opacity: 0.7 }}>Edition</td>
                          <td style={{ padding: '2px 0', fontFamily: 'monospace' }}>
                            {it.editionLabels.join(', ')}
                          </td>
                        </tr>
                      )}
                      {it.editionName && (
                        <tr>
                          <td style={{ padding: '2px 16px 2px 0', opacity: 0.7 }}>Variant</td>
                          <td style={{ padding: '2px 0', fontFamily: 'monospace' }}>
                            {it.editionName}
                          </td>
                        </tr>
                      )}
                      {it.specsSummary.map((s) => (
                        <tr key={s.id}>
                          <td style={{ padding: '2px 16px 2px 0', opacity: 0.7 }}>{s.label}</td>
                          <td style={{ padding: '2px 0', fontFamily: 'monospace' }}>{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
                    Specs unavailable — see the raw printConfig in the timeline payload.
                  </p>
                )}
              </div>
            ))
          : order.specs.length > 0 && (
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
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            {order.buyerName}
            <br />
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
            <br />
            {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
            <br />
            {countryName(addr.country)}
            {addr.phone ? (
              <>
                <br />
                {addr.phone}
              </>
            ) : null}
          </div>
          <div style={{ marginTop: 8 }}>
            <CopyButton
              value={[
                order.buyerName,
                [addr.line1, addr.line2].filter(Boolean).join(', '),
                [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
                countryName(addr.country),
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

      {/* Re-order / replacement reprint — available once a print physically
          exists (produced/shipped/delivered). Resets the order to "To place at
          TPS" for a fresh copy WITHOUT re-charging; same edition number remade.
          A sanctioned backward move, kept apart from the forward CTA. */}
      {order.paymentStatus === 'succeeded' &&
        ['Started', 'Shipped', 'Complete'].includes(order.fulfillmentStatus ?? '') && (
          <div className={dashboardStyles.section}>
            {!reorderOpen ? (
              <Button
                font="dashboard"
                variant="secondary"
                label="Re-order (reprint)"
                onClick={() => {
                  setReorderError(null)
                  setReorderOpen(true)
                }}
              />
            ) : (
              <div
                style={{
                  padding: 16,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 4,
                  background: '#fafafa',
                }}
              >
                <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                  <strong>Re-order this print (replacement reprint)</strong> — resets the order to{' '}
                  <strong>To place at TPS</strong> so you can send a fresh copy to the print
                  partner. The buyer is <strong>not</strong> charged again and keeps their edition
                  number.
                </p>

                {order.reorderCount >= 2 && (
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
                    ⚠️ This order has already been reprinted <strong>{order.reorderCount}</strong>{' '}
                    times — a refund may serve the buyer better. You can still proceed.
                  </p>
                )}

                <label
                  htmlFor="reorder-reason"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.7,
                  }}
                >
                  Reason
                </label>
                <select
                  id="reorder-reason"
                  value={reorderReason}
                  onChange={(e) => setReorderReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                >
                  <option value="">Select a reason…</option>
                  {REORDER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REORDER_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>

                <textarea
                  value={reorderNote}
                  onChange={(e) => setReorderNote(e.target.value)}
                  rows={2}
                  placeholder="Optional note (e.g. corner crushed in transit)"
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

                {reorderError && (
                  <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                    ⚠️ {reorderError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button
                    font="dashboard"
                    variant="danger"
                    label={reordering ? 'Re-ordering…' : 'Confirm re-order'}
                    onClick={handleReorder}
                    disabled={reordering || reorderReason.length === 0}
                  />
                  <Button
                    font="dashboard"
                    variant="secondary"
                    label="Cancel"
                    onClick={() => {
                      setReorderOpen(false)
                      setReorderReason('')
                      setReorderNote('')
                      setReorderError(null)
                    }}
                    disabled={reordering}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      {/* Invoice — two states (no fulfillment gate; admin issues at will):
          1. Invoice exists → number + "See invoice" + "Send invoice again"
             (re-send is idempotent — same PDF + number, as many times as needed).
             When a credit note also exists, the original invoice is shown as Voided.
          2. No invoice yet → "Send invoice" CTA (available at any stage). */}
      <div className={dashboardStyles.section}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Invoice</h2>
        {order.invoice ? (
          <div style={{ marginTop: 12 }}>
            {/* Actions row — number + all buttons on one line */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{order.invoice.number}</span>
              {order.creditNote && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    background: 'var(--color-badge-danger-bg)',
                    color: 'var(--color-badge-danger-text)',
                    letterSpacing: '0.03em',
                  }}
                >
                  Voided
                </span>
              )}
              <Button
                font="dashboard"
                variant="secondary"
                size="small"
                label="See invoice"
                href={`/admin/invoices/${order.invoice.id}/download`}
              />
              {!order.creditNote && (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    size="small"
                    label={sendingInvoice ? 'Sending…' : 'Send invoice again'}
                    onClick={() => {
                      setInvoiceError(null)
                      setInvoiceConfirmOpen(true)
                    }}
                    disabled={sendingInvoice}
                  />
                  <Button
                    font="dashboard"
                    variant="danger"
                    size="small"
                    label={issuingCreditNote ? 'Issuing…' : 'Issue credit note'}
                    onClick={() => {
                      setCreditNoteError(null)
                      setCreditNoteConfirmOpen(true)
                    }}
                    disabled={issuingCreditNote}
                  />
                </>
              )}
            </div>

            {/* Credit note row (if exists) */}
            {order.creditNote && (
              <div style={{ marginTop: 10 }}>
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Credit note:
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontFamily: 'monospace' }}>
                    {order.creditNote.number}
                  </span>
                  <Button
                    font="dashboard"
                    variant="secondary"
                    size="small"
                    label="See credit note"
                    href={`/admin/invoices/${order.creditNote.id}/download`}
                  />
                  <Button
                    font="dashboard"
                    variant="secondary"
                    size="small"
                    label={issuingCreditNote ? 'Sending…' : 'Send credit note again'}
                    onClick={() => void handleIssueCreditNote()}
                    disabled={issuingCreditNote}
                  />
                </div>
              </div>
            )}

            {(invoiceError || creditNoteError) && (
              <p style={{ margin: '8px 0 0 0', color: 'var(--color-error-text)', fontSize: 13 }}>
                ⚠️ {invoiceError || creditNoteError}
              </p>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 12px 0' }}>
              Issue the invoice and email it to the buyer. The invoice number is minted once —
              re-sending reuses the same number.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                font="dashboard"
                variant="primary"
                size="small"
                label={sendingInvoice ? 'Sending…' : 'Send invoice'}
                onClick={() => {
                  setInvoiceError(null)
                  setInvoiceConfirmOpen(true)
                }}
                disabled={sendingInvoice}
              />
            </div>
            {invoiceError && (
              <p style={{ margin: '8px 0 0 0', color: 'var(--color-error-text)', fontSize: 13 }}>
                ⚠️ {invoiceError}
              </p>
            )}
          </div>
        )}
      </div>

      {invoiceConfirmOpen && order && (
        <ConfirmModal
          title={order.invoice ? 'Re-send invoice?' : 'Issue and send invoice?'}
          message={
            order.invoice ? (
              <>
                This will re-email invoice <code>{order.invoice.number}</code> to{' '}
                <strong>{order.buyerEmail}</strong>. The same PDF and number are reused — no new
                invoice is created.
              </>
            ) : (
              <>
                This will issue an invoice for order <code>{formatOrderRef(order.id)}</code> and
                email it to <strong>{order.buyerEmail}</strong>. The invoice number is permanent —
                it cannot be voided from this screen.
              </>
            )
          }
          confirmLabel={order.invoice ? 'Yes, re-send' : 'Yes, send invoice'}
          cancelLabel="Cancel"
          busy={sendingInvoice}
          onConfirm={handleSendInvoice}
          onCancel={() => setInvoiceConfirmOpen(false)}
        />
      )}

      {creditNoteConfirmOpen && order && order.invoice && (
        <ConfirmModal
          title="Issue credit note?"
          message={
            <div>
              <p style={{ margin: '0 0 12px 0' }}>
                This will issue a credit note correcting invoice <code>{order.invoice.number}</code>{' '}
                and email it to <strong>{order.buyerEmail}</strong>.
              </p>
              <p
                style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--color-text-secondary)' }}
              >
                This cannot be undone. Both documents (invoice + credit note) go to the accountant
                and net to zero.
              </p>
              <div>
                <label
                  htmlFor="credit-note-reason"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Reason (optional)
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {['Refund', 'Issued in error'].map((preset) => (
                    <Button
                      key={preset}
                      font="dashboard"
                      variant="ghost"
                      size="small"
                      label={preset}
                      onClick={() => setCreditNoteReason(preset)}
                    />
                  ))}
                </div>
                <Input
                  id="credit-note-reason"
                  type="text"
                  placeholder="e.g. Order canceled by buyer"
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                />
              </div>
            </div>
          }
          confirmLabel={issuingCreditNote ? 'Issuing…' : 'Yes, issue credit note'}
          cancelLabel="Cancel"
          busy={issuingCreditNote}
          onConfirm={handleIssueCreditNote}
          onCancel={() => {
            setCreditNoteConfirmOpen(false)
            setCreditNoteReason('')
          }}
        />
      )}

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
              <code>{formatOrderRef(order.id)}</code>.
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

      {/* Danger zone — dev/staging ONLY. In production orders are never
          deleted: they are business records (Stripe cross-reference, audit
          trail, disputes) — 'Cancelled' is the terminal state there, and an
          invoiced order is corrected via credit note. The server action
          enforces this too; hiding the section is just honest UI. */}
      {DEV_CLEANUP_ALLOWED && (
        <div className={dashboardStyles.section}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Danger zone</h2>
          <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
            Test-data cleanup ({process.env.NEXT_PUBLIC_APP_ENV ?? 'development'} only — not
            available in production). Permanently deletes this order, its event history, its
            invoices and their PDFs, and returns its edition numbers to the pool.
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
      )}

      {deleteConfirmOpen && (
        <ConfirmModal
          title="Delete this order?"
          message={
            <>
              This will <strong>permanently remove</strong> order{' '}
              <code>{formatOrderRef(order.id)}</code> and its entire event history from the
              database.
              {order.paymentStatus === 'authorized' && (
                <>
                  <br />
                  <br />
                  The Stripe card hold ({formatEuro(order.totalCents)}) will be canceled
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
