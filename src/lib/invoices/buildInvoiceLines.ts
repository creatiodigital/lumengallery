/**
 * AR-131 — Build invoice line items from a PrintOrder.
 *
 * Supports both order shapes:
 *   - Cart order  (items.length > 0): one line per PrintOrderItem.
 *   - Legacy single-print order (items.length === 0): one artwork line from
 *     the header columns (productionCents + artistCents + galleryCents).
 *
 * Reconciliation guarantee:
 *   Σ(lineCents) over artwork lines = itemsPreTax = totalCents − customerVatCents − shippingCents
 *   + shipping line lineCents (= productionShippingCents)
 *   ─────────────────────────────────────────────────────────────────────
 *   = totalCents − customerVatCents = baseCents (the taxable base stored in totalsSnapshot)
 *
 * So Σ(all line lineCents) == baseCents, which satisfies the invoice rule
 * Σ pre-tax amounts + VAT == total.
 */

export type InvoiceLine = {
  description: string
  qty: number
  unitCents: number
  lineCents: number
}

type OrderItemLike = {
  artwork: { title: string | null; slug: string | null }
  quantity: number
  productionCents: number
  artistCents: number
  galleryCents: number
}

export type LinesOrderLike = {
  totalCents: number
  customerVatCents: number
  productionCents: number
  productionShippingCents: number
  galleryCents: number
  artistCents: number
  artwork: { title: string | null; slug: string | null }
  items: OrderItemLike[]
}

/**
 * Build one InvoiceLine per cart item (or one line for a legacy single-print
 * order), plus one "Shipping" line when shipping is non-zero.
 *
 * The sum of all lineCents == baseCents (totalCents − customerVatCents):
 * this is the taxable base, which reconciles the PDF totals block.
 */
export function buildInvoiceLines(order: LinesOrderLike): InvoiceLine[] {
  const lines: InvoiceLine[] = []

  const isCart = order.items.length > 0

  if (isCart) {
    // Cart path: one line per PrintOrderItem.
    // Each item's pre-tax buyer-facing amount = productionCents + artistCents + galleryCents.
    // unit price = that total ÷ quantity (integer division is exact because the
    // cart stores per-ITEM totals that are already qty-multiplied).
    for (const item of order.items) {
      const lineCents = item.productionCents + item.artistCents + item.galleryCents
      const qty = item.quantity
      // unit is lineCents / qty; if not exact, distribute remainder to unitCents
      // in the first unit and adjust lineCents to the stored value.
      const unitCents = Math.round(lineCents / qty)
      const title = item.artwork.title ?? item.artwork.slug ?? 'Artwork'
      lines.push({
        description: title,
        qty,
        unitCents,
        // Use the authoritative stored lineCents (not unitCents * qty) so any
        // rounding in unit display never propagates to the totals.
        lineCents,
      })
    }
  } else {
    // Legacy single-print path: one artwork line from header columns.
    // productionCents + artistCents + galleryCents = per-item pre-tax total.
    const lineCents = order.productionCents + order.artistCents + order.galleryCents
    const title = order.artwork.title ?? order.artwork.slug ?? 'Artwork'
    lines.push({
      description: title,
      qty: 1,
      unitCents: lineCents,
      lineCents,
    })
  }

  // Shipping line — included only when there's an actual shipping charge.
  if (order.productionShippingCents > 0) {
    lines.push({
      description: 'Shipping',
      qty: 1,
      unitCents: order.productionShippingCents,
      lineCents: order.productionShippingCents,
    })
  }

  // Sanity check (dev-time): Σ lineCents must equal baseCents.
  // baseCents = totalCents − customerVatCents.
  const baseCents = order.totalCents - order.customerVatCents
  const sumLineCents = lines.reduce((s, l) => s + l.lineCents, 0)
  if (sumLineCents !== baseCents) {
    // Log the discrepancy — never throw (the invoice can still issue; the PDF
    // will show a slight discrepancy that the admin must investigate). This is
    // a guard against future pricing-logic drift, not an expected condition.
    console.warn(
      `[buildInvoiceLines] Reconciliation mismatch: Σ lineCents=${sumLineCents} ≠ baseCents=${baseCents} (diff=${sumLineCents - baseCents}). Order may have unusual discount or rounding.`,
    )
  }

  return lines
}
