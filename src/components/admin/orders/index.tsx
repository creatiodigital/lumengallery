'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { daysSinceDelivered, PAYOUT_SAFE_WINDOW_DAYS } from '@/lib/orders/payoutPolicy'
import { formatEuro } from '@/lib/print-providers/format'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

import { listOrders, type AdminOrderRow } from '@/app/admin/orders/actions'

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const DOT_COLORS: Record<string, string> = {
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  grey: '#9ca3af',
}

const Dot = ({ color }: { color: keyof typeof DOT_COLORS }) => (
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

// Workflow buckets — each bucket corresponds to one tab on the orders
// page. Order matters (it's the user's mental left-to-right pipeline).
type Bucket =
  | 'new'
  | 'at-tps'
  | 'production'
  | 'shipped'
  | 'delivered'
  | 'done'
  | 'rejected'
  | 'refunded'
  | 'attention'

const BUCKET_ORDER: Bucket[] = [
  'new',
  'at-tps',
  'production',
  'shipped',
  'delivered',
  'done',
  'rejected',
  'refunded',
  'attention',
]

const BUCKET_META: Record<
  Bucket,
  {
    title: string
    helper: string
    nextAction: string
  }
> = {
  new: {
    title: 'New',
    helper:
      'Buyer paid; card is on hold. Place the order on theprintspace, then click Capture & mark placed to charge the buyer and advance.',
    nextAction: 'Capture & mark placed',
  },
  'at-tps': {
    title: 'At TPS',
    helper:
      'Order placed at theprintspace; payment captured. Click Mark in production once TPS confirms they’re printing.',
    nextAction: 'Mark in production',
  },
  production: {
    title: 'In production',
    helper: 'TPS is printing. Once they ship, paste the tracking URL to advance.',
    nextAction: 'Mark shipped',
  },
  shipped: {
    title: 'Shipped',
    helper: 'TPS shipped. Mark delivered once the buyer confirms receipt.',
    nextAction: 'Mark delivered',
  },
  delivered: {
    title: 'Delivered',
    helper: `Buyer received the print. You can pay the artist any time — the ${PAYOUT_SAFE_WINDOW_DAYS}-day counter is just a buyer-dispute risk hint.`,
    nextAction: 'Pay the Artist',
  },
  done: {
    title: 'Artist paid',
    helper: 'Order delivered and artist paid. Archived view.',
    nextAction: 'View details',
  },
  rejected: {
    title: 'Rejected',
    helper:
      'Orders pulled out of the pipeline before delivery — TPS rejected the file, artist disabled prints, etc. Refunds (if needed) are handled from the order detail page.',
    nextAction: 'View details',
  },
  refunded: {
    title: 'Refunded',
    helper:
      'Buyer was refunded — money returned, no further action. Refunds can happen at any stage (e.g. pre-placement cancel, post-delivery goodwill).',
    nextAction: 'View details',
  },
  attention: {
    title: 'Needs attention',
    helper:
      'Failed payments, rejected orders, refunds. Each case differs — open the order to refund, cancel, or close it out.',
    nextAction: 'Open & resolve →',
  },
}

function bucketOf(o: AdminOrderRow): Bucket {
  const f = o.fulfillmentStatus
  const p = o.paymentStatus

  if (f === 'Rejected') return 'rejected'
  if (p === 'refunded') return 'refunded'
  if (p === 'failed' || p === 'canceled') return 'attention'

  if (f === null && p === 'authorized') return 'new'
  if (f === 'Placed') return 'at-tps'
  if (f === 'Started') return 'production'
  if (f === 'Shipped') return 'shipped'
  // `paidOutAt` is the universal "artist has been paid" signal — set
  // by both Stripe Connect transfers and out-of-band manual payments.
  // `transferId` only tracks the Stripe path.
  if (f === 'Complete' && !o.paidOutAt) return 'delivered'
  if (f === 'Complete' && o.paidOutAt) return 'done'

  return 'attention'
}

export const AdminOrders = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeBucket, setActiveBucket] = useState<Bucket>('new')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const load = useCallback(async () => {
    setError(null)
    const res = await listOrders()
    if (res.ok) setOrders(res.orders)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const grouped = useMemo(() => {
    const map: Record<Bucket, AdminOrderRow[]> = {
      new: [],
      'at-tps': [],
      production: [],
      shipped: [],
      delivered: [],
      done: [],
      rejected: [],
      refunded: [],
      attention: [],
    }
    for (const o of orders) {
      map[bucketOf(o)].push(o)
    }
    return map
  }, [orders])

  const visibleOrders = grouped[activeBucket]
  const activeMeta = BUCKET_META[activeBucket]

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Orders</h1>

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Order workflow stages"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          marginBottom: 12,
          marginTop: 8,
        }}
      >
        {BUCKET_ORDER.map((b) => {
          const meta = BUCKET_META[b]
          const count = grouped[b].length
          const active = b === activeBucket
          const isAttention = b === 'attention' || b === 'rejected'
          const isRefunded = b === 'refunded'
          const hasItems = count > 0
          // Refunded only goes orange when there's *more than one* —
          // a single refund is unremarkable, multiples are a pattern
          // worth flagging.
          const refundedAlert = isRefunded && count > 1
          const colorize =
            hasItems && (isAttention || refundedAlert || (!isRefunded && !isAttention))
          const pillBg = !colorize
            ? 'rgba(0,0,0,0.06)'
            : isAttention
              ? '#fdecea'
              : isRefunded
                ? '#ffedd5'
                : '#d1fae5'
          const pillColor = !colorize
            ? 'inherit'
            : isAttention
              ? '#b91c1c'
              : isRefunded
                ? '#9a3412'
                : '#065f46'
          return (
            <Button
              key={b}
              variant="ghost"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveBucket(b)}
              style={{
                padding: '8px 14px',
                background: active ? 'var(--color-white)' : 'transparent',
                border: '1px solid',
                borderColor: active ? 'var(--color-border-strong)' : 'transparent',
                borderBottomColor: active ? 'var(--color-white)' : 'transparent',
                marginBottom: -1,
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: active ? 600 : 400,
              }}
            >
              {meta.title}
              <span
                style={{
                  marginLeft: 6,
                  padding: '1px 7px',
                  borderRadius: 10,
                  background: pillBg,
                  fontSize: 11,
                  color: pillColor,
                }}
              >
                {count}
              </span>
            </Button>
          )
        })}
      </div>

      <div className={dashboardStyles.section}>
        <p
          className={dashboardStyles.sectionDescription}
          style={{ margin: '0 0 16px 0', fontSize: 13 }}
        >
          {activeMeta.helper}
        </p>

        {(() => {
          if (loading) {
            return <p className={dashboardStyles.sectionDescription}>Loading…</p>
          }
          if (visibleOrders.length === 0) {
            return (
              <EmptyState
                message={
                  activeBucket === 'new'
                    ? 'No new orders right now.'
                    : `No orders in "${activeMeta.title}".`
                }
              />
            )
          }
          return (
            <table className={dashboardStyles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Total</th>
                  {activeBucket === 'shipped' || activeBucket === 'delivered' ? (
                    <th>Shipped</th>
                  ) : null}
                  {activeBucket === 'delivered' || activeBucket === 'done' ? (
                    <th>Artist payout</th>
                  ) : null}
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</td>
                    <td>
                      <div>{o.artwork.title ?? o.artwork.slug ?? o.artwork.id}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>
                        {o.artist.name}
                      </div>
                    </td>
                    <td>
                      <div>{o.buyerName}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>
                        {o.buyerEmail}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatEuro(o.totalCents)}</td>

                    {(activeBucket === 'shipped' || activeBucket === 'delivered') && (
                      <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                        {o.shippedAt ? formatDate(o.shippedAt) : '—'}
                      </td>
                    )}

                    {(activeBucket === 'delivered' || activeBucket === 'done') && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                          if (o.paidOutAt) {
                            const isManual = o.transferStatus === 'paid_manual'
                            return (
                              <>
                                <Dot color="green" />
                                <span style={{ fontSize: 'var(--text-xs)' }}>
                                  {formatEuro(o.artistCents)} · {formatDate(o.paidOutAt)}
                                  {isManual ? ' (manual)' : ''}
                                </span>
                              </>
                            )
                          }
                          const days = daysSinceDelivered(o.shippedAt)
                          if (days === null) {
                            return (
                              <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>—</span>
                            )
                          }
                          const past = days >= PAYOUT_SAFE_WINDOW_DAYS
                          const remaining = Math.max(0, PAYOUT_SAFE_WINDOW_DAYS - days)
                          return (
                            <>
                              <Dot color={past ? 'green' : 'amber'} />
                              <span style={{ fontSize: 'var(--text-xs)' }}>
                                {days}d since delivered ·{' '}
                                {past ? 'safe window passed' : `${remaining}d to safe window`}
                              </span>
                            </>
                          )
                        })()}
                      </td>
                    )}

                    <td style={{ whiteSpace: 'nowrap' }}>
                      <NextActionCell order={o} bucket={activeBucket} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>
    </DashboardLayout>
  )
}

const NextActionCell = ({ order, bucket }: { order: AdminOrderRow; bucket: Bucket }) => {
  const meta = BUCKET_META[bucket]

  // Every row in every bucket is just a doorway to the detail page.
  // Real actions (capture, mark in production, refund, pay artist…)
  // only fire from the detail page, where the admin sees full context
  // and can't trip them with an accidental table tap.
  const linkStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '6px 12px',
    background: bucket === 'attention' ? '#b91c1c' : '#111',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 3,
    fontSize: 12,
    whiteSpace: 'nowrap',
  }

  return (
    <Link href={`/admin/orders/${order.id}`} style={linkStyle}>
      {meta.nextAction}
    </Link>
  )
}
