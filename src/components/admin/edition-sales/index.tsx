'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Gift, Palette, PrinterCheck, type LucideIcon } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

import {
  createOffPlatformOrder,
  listEditionSales,
  listGiftableVariants,
  releaseOrphanedEditionNumber,
  type EditionSaleRow,
  type GiftableVariantRow,
} from '@/app/admin/orders/actions'
import {
  OFF_PLATFORM_KINDS,
  OFF_PLATFORM_KIND_LABELS,
  type OffPlatformKind,
} from '@/lib/orders/offPlatformKinds'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '—'

/** Lucide marks for the off-platform kinds — never system emoji (house rule). */
const OFF_PLATFORM_ICONS: Record<OffPlatformKind, LucideIcon> = {
  gift: Gift,
  artist_copy: Palette,
  test: PrinterCheck,
}

const KindMark = ({ kind }: { kind: OffPlatformKind }) => {
  const Icon = OFF_PLATFORM_ICONS[kind]
  return Icon ? (
    <Icon
      size={14}
      strokeWidth={ICON_STROKE_WIDTH}
      style={{ verticalAlign: 'text-bottom', marginRight: 6 }}
      aria-hidden
    />
  ) : null
}

const fieldStyle = {
  width: '100%',
  padding: 8,
  border: '1px solid rgba(0,0,0,0.2)',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: 13,
  boxSizing: 'border-box',
  marginBottom: 12,
} as const


/**
 * Admin ledger of every numbered limited-edition copy that's been
 * reserved or sold — which number, to whom, for which artwork + variant,
 * and whether it's been mirrored as sold in TPS. Our authoritative record.
 */
export const AdminEditionSales = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  // Deep link from a variant card ("Create gift order"): ?gift=<variantId>
  // auto-opens the modal with that variant preselected, once.
  const searchParams = useSearchParams()
  const giftParamHandled = useRef(false)

  const [sales, setSales] = useState<EditionSaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-row release (manual cleanup of orphaned, order-less reservations —
  // frees the number back to available without removing the slot).
  const [releaseTarget, setReleaseTarget] = useState<EditionSaleRow | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

  // Off-platform copy (gift / artist copy / test) — consumes a number by
  // hand, no Stripe, no order. Variants + free numbers load when the modal
  // opens so the pickers are always current.
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftVariants, setGiftVariants] = useState<GiftableVariantRow[]>([])
  const [giftVariantId, setGiftVariantId] = useState('')
  const [giftNumber, setGiftNumber] = useState<number | ''>('')
  const [giftKind, setGiftKind] = useState<OffPlatformKind>('gift')
  const [giftRecipient, setGiftRecipient] = useState('')
  // Full shipping address — copied by the admin into the TPS portal when
  // placing the physical order (so it must be complete enough to ship).
  const emptyAddress = { line1: '', line2: '', city: '', state: '', postalCode: '', country: '', phone: '' }
  const [giftAddress, setGiftAddress] = useState(emptyAddress)
  const setAddr = (field: keyof typeof emptyAddress, value: string) =>
    setGiftAddress((a) => ({ ...a, [field]: value }))
  const [giftNote, setGiftNote] = useState('')
  const [giftSaving, setGiftSaving] = useState(false)
  const [giftError, setGiftError] = useState<string | null>(null)

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

  // Variant-card deep link: /admin/edition-sales?gift=<variantId> opens the
  // modal preselected on that variant (admin clicked "Create gift order" on
  // an artwork's variant panel).
  const giftParam = searchParams.get('gift')
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !giftParam || giftParamHandled.current) return
    giftParamHandled.current = true
    openGift(giftParam)
    // openGift is stable in behaviour but not in identity — run-once guard
    // (giftParamHandled) makes the dependency irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, giftParam])

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

  const selectedGiftVariant = giftVariants.find((v) => v.variantId === giftVariantId) ?? null

  // The modal is ALWAYS scoped to one variant — the admin clicked "Create
  // gift order" on that variant's card, so the context is already chosen and
  // is displayed read-only (no picker; Eduardo, 2026-07-25).
  const openGift = async (variantId: string) => {
    setGiftError(null)
    setGiftNote('')
    setGiftRecipient('')
    setGiftAddress(emptyAddress)
    setGiftKind('gift')
    setGiftOpen(true)
    const res = await listGiftableVariants()
    if (!res.ok) {
      setGiftVariants([])
      setGiftError(res.error)
      return
    }
    setGiftVariants(res.variants)
    const target = res.variants.find((v) => v.variantId === variantId)
    if (!target) {
      setGiftError(
        'This variant has no available numbers left (or is not published) — nothing to gift.',
      )
      setGiftVariantId('')
      setGiftNumber('')
      return
    }
    setGiftVariantId(target.variantId)
    setGiftNumber(target.availableNumbers[0] ?? '')
  }

  const handleGiftConfirm = async () => {
    if (!giftVariantId || giftNumber === '') {
      setGiftError('Pick a variant and a number.')
      return
    }
    if (!giftRecipient.trim()) {
      setGiftError('A recipient name is required.')
      return
    }
    if (
      !giftAddress.line1.trim() ||
      !giftAddress.city.trim() ||
      !giftAddress.postalCode.trim() ||
      !giftAddress.country.trim()
    ) {
      setGiftError('Street, city, postal code and country are required (they go to TPS).')
      return
    }
    setGiftSaving(true)
    setGiftError(null)
    const res = await createOffPlatformOrder({
      variantId: giftVariantId,
      number: giftNumber,
      kind: giftKind,
      recipientName: giftRecipient,
      address: giftAddress,
      note: giftNote,
    })
    setGiftSaving(false)
    if (res.ok) {
      setGiftOpen(false)
      await load()
    } else {
      setGiftError(res.error)
    }
  }

  const closeGift = () => {
    if (giftSaving) return
    setGiftOpen(false)
    setGiftError(null)
  }

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Limited edition sales</h1>
      <p className={dashboardStyles.sectionDescription}>
        Every numbered copy that&apos;s been reserved or sold — who holds it, for which artwork and
        variant, and whether it&apos;s been mirrored as sold in The Print Space. Our authoritative
        record. Newest first.
      </p>

      {/* Off-platform copies (gifts, artist copies, test prints) are created
          from the artwork's variant panel — the "Create gift order" button on
          a live variant deep-links here with ?gift=<variantId>, which opens
          the modal below preselected. No standalone entry point on this page
          (Eduardo, 2026-07-25). */}

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
                      {s.offPlatformKind ? (
                        <>
                          <div style={{ whiteSpace: 'nowrap' }}>
                            <KindMark kind={s.offPlatformKind as OffPlatformKind} />
                            {OFF_PLATFORM_KIND_LABELS[s.offPlatformKind as OffPlatformKind] ??
                              s.offPlatformKind}
                          </div>
                          {s.offPlatformNote && (
                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                              {s.offPlatformNote}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div>{s.buyerName ?? '—'}</div>
                          {s.buyerEmail && (
                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                              {s.buyerEmail}
                            </div>
                          )}
                        </>
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

      {giftOpen && (
        <ConfirmModal
          size="wide"
          title="Add an off-platform copy"
          message={
            <>
              <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                Consume a numbered copy <strong>without a sale</strong> — a gallery gift, an
                artist-retained copy, or a test print. The number is marked sold in the ledger so
                it can never be sold to a buyer, and the parcel gets its own entry on{' '}
                <strong>Gift orders</strong> with the usual fulfillment stages. Remember to also
                tick the number in The Print Space&apos;s editions panel.
              </p>

              {giftVariants.length === 0 && !giftError ? (
                <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>Loading…</p>
              ) : !selectedGiftVariant ? null : (
                <>
                  {/* The variant is fixed — chosen by the button the admin
                      clicked. Read-only context, not a picker. */}
                  <div className={dashboardStyles.field}>
                    <label>Artwork · variant</label>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                      {selectedGiftVariant.artworkTitle} ({selectedGiftVariant.artistName}) —{' '}
                      {selectedGiftVariant.variantName} ·{' '}
                      {selectedGiftVariant.availableNumbers.length} of{' '}
                      {selectedGiftVariant.editionSize} free
                    </p>
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Number</label>
                    <SelectDropdown<string>
                      options={(selectedGiftVariant?.availableNumbers ?? []).map((n) => ({
                        value: String(n),
                        label: `${n}/${selectedGiftVariant?.editionSize}`,
                      }))}
                      value={giftNumber === '' ? '' : String(giftNumber)}
                      onChange={(v) => setGiftNumber(Number(v))}
                    />
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Kind</label>
                    <SelectDropdown<OffPlatformKind>
                      options={OFF_PLATFORM_KINDS.map((k) => ({
                        value: k,
                        label: OFF_PLATFORM_KIND_LABELS[k],
                        badge: <KindMark kind={k} />,
                      }))}
                      value={giftKind}
                      onChange={(v) => setGiftKind(v)}
                    />
                    {/* Kind decides the artist fee: gifts owe the artist's cut
                        (snapshotted now); artist copies / tests owe nothing. */}
                    {giftKind === 'gift' ? (
                      <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.75 }}>
                        Artist fee owed:{' '}
                        <strong>
                          €{((selectedGiftVariant.artistPriceCents ?? 0) / 100).toFixed(2)}
                        </strong>{' '}
                        — a gift still pays the artist their cut (no gallery cut).
                      </p>
                    ) : (
                      <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.75 }}>
                        No artist fee — artist copies and test prints owe nothing.
                      </p>
                    )}
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Recipient</label>
                    <Input
                      id="gift-recipient"
                      type="text"
                      size="medium"
                      value={giftRecipient}
                      onChange={(e) => setGiftRecipient(e.target.value)}
                      placeholder="Who receives this print (e.g. Mathias Heizmann)"
                    />
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Street address</label>
                    <Input
                      id="gift-line1"
                      type="text"
                      size="medium"
                      value={giftAddress.line1}
                      onChange={(e) => setAddr('line1', e.target.value)}
                      placeholder="Street and number"
                    />
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Address line 2 (optional)</label>
                    <Input
                      id="gift-line2"
                      type="text"
                      size="medium"
                      value={giftAddress.line2}
                      onChange={(e) => setAddr('line2', e.target.value)}
                      placeholder="Apartment, floor, c/o…"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className={dashboardStyles.field} style={{ flex: 1 }}>
                      <label>City</label>
                      <Input
                        id="gift-city"
                        type="text"
                        size="medium"
                        value={giftAddress.city}
                        onChange={(e) => setAddr('city', e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className={dashboardStyles.field} style={{ width: 140 }}>
                      <label>Postal code</label>
                      <Input
                        id="gift-postal"
                        type="text"
                        size="medium"
                        value={giftAddress.postalCode}
                        onChange={(e) => setAddr('postalCode', e.target.value)}
                        placeholder="e.g. 28220"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className={dashboardStyles.field} style={{ flex: 1 }}>
                      <label>Region / state (optional)</label>
                      <Input
                        id="gift-state"
                        type="text"
                        size="medium"
                        value={giftAddress.state}
                        onChange={(e) => setAddr('state', e.target.value)}
                        placeholder="e.g. Bayern"
                      />
                    </div>
                    <div className={dashboardStyles.field} style={{ flex: 1 }}>
                      <label>Country</label>
                      <Input
                        id="gift-country"
                        type="text"
                        size="medium"
                        value={giftAddress.country}
                        onChange={(e) => setAddr('country', e.target.value)}
                        placeholder="e.g. Germany"
                      />
                    </div>
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Phone (optional, for the courier)</label>
                    <Input
                      id="gift-phone"
                      type="text"
                      size="medium"
                      value={giftAddress.phone}
                      onChange={(e) => setAddr('phone', e.target.value)}
                      placeholder="+49…"
                    />
                  </div>

                  <div className={dashboardStyles.field}>
                    <label>Note</label>
                    <textarea
                      id="gift-note"
                      value={giftNote}
                      onChange={(e) => setGiftNote(e.target.value)}
                      rows={2}
                      placeholder="Reason / TPS order ref (e.g. test print, TPS WB-AA12345)"
                      style={{ ...fieldStyle, marginBottom: 0, resize: 'vertical' }}
                    />
                  </div>
                </>
              )}
            </>
          }
          warning={giftError ? <>⚠️ {giftError}</> : null}
          confirmLabel="Mark number as taken"
          cancelLabel="Cancel"
          busy={giftSaving || (giftVariants.length === 0 && !giftError)}
          onConfirm={handleGiftConfirm}
          onCancel={closeGift}
        />
      )}

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
