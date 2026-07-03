/**
 * AR-131 — Branded invoice PDF component.
 *
 * Renders a gallery-quality A4 invoice or credit note using @react-pdf/renderer.
 * Typography: Lora (serif, headings) + Manrope (sans, labels/figures).
 * Colors: matched to EMAIL_BRAND tokens.
 */

import path from 'path'

import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { formatMoneyCents } from '@/lib/money'

import type { InvoiceLine } from './buildInvoiceLines'
import type { BuyerSnapshot, SellerSnapshot, TotalsSnapshot } from './buildInvoiceSnapshots'

// ---------------------------------------------------------------------------
// Font registration — server-side paths relative to process.cwd() (repo root)
// ---------------------------------------------------------------------------

const fontDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lora',
  fonts: [
    { src: path.join(fontDir, 'lora-regular.ttf'), fontWeight: 'normal', fontStyle: 'normal' },
    { src: path.join(fontDir, 'lora-bold.ttf'), fontWeight: 'bold', fontStyle: 'normal' },
    { src: path.join(fontDir, 'lora-italic.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
    { src: path.join(fontDir, 'lora-bold-italic.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
  ],
})

Font.register({
  family: 'Manrope',
  fonts: [
    { src: path.join(fontDir, 'manrope-regular.ttf'), fontWeight: 'normal', fontStyle: 'normal' },
    { src: path.join(fontDir, 'manrope-bold.ttf'), fontWeight: 'bold', fontStyle: 'normal' },
  ],
})

// ---------------------------------------------------------------------------
// Brand tokens (mirrors EMAIL_BRAND — duplicated here to avoid Next.js import)
// ---------------------------------------------------------------------------

const BRAND = {
  red: '#bd1622',
  ink: '#111111',
  bodyText: '#333333',
  muted: '#595959',
  hairline: '#eeeeee',
  beige: '#faf9f6',
} as const

// ---------------------------------------------------------------------------
// Asset paths
// ---------------------------------------------------------------------------

const WORDMARK_PATH = path.join(process.cwd(), 'public', 'email', 'wordmark@2x.png')
const MONOGRAM_PATH = path.join(process.cwd(), 'public', 'email', 'monogram@2x.png')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Currency = string

// Shared formatter (grouped thousands, Unicode minus) — the PDF, emails and
// admin surfaces must all render the same amount identically.
function formatMoney(cents: number, currency: Currency): string {
  return formatMoneyCents(cents, currency)
}

function formatDate(d: Date): string {
  // Pinned to the gallery's tax timezone so the printed date always agrees
  // with the number's (series, year, month) period, which is derived in
  // Europe/Madrid too — never the server's local zone.
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  })
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Manrope',
    fontSize: 9,
    color: BRAND.bodyText,
    backgroundColor: '#ffffff',
    paddingTop: 44,
    // Room for the fixed footer (divider + monogram + legal lines).
    paddingBottom: 120,
    paddingHorizontal: 52,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  wordmark: {
    width: 130,
    height: 'auto' as unknown as number, // react-pdf accepts this at runtime
  },
  sellerBlock: {
    textAlign: 'right',
    maxWidth: 220,
  },
  sellerName: {
    fontFamily: 'Lora',
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND.ink,
    marginBottom: 3,
  },
  sellerLine: {
    fontSize: 8,
    color: BRAND.muted,
    lineHeight: 1.5,
  },
  sellerNif: {
    fontSize: 8,
    fontWeight: 'bold',
    color: BRAND.muted,
    marginTop: 3,
    lineHeight: 1.5,
  },

  // ── Red accent rule ──────────────────────────────────────────────────────
  redRule: {
    height: 1.5,
    backgroundColor: BRAND.red,
    marginBottom: 20,
  },

  // ── Title row ───────────────────────────────────────────────────────────
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  docType: {
    fontFamily: 'Lora',
    fontSize: 22,
    fontWeight: 'bold',
    color: BRAND.ink,
    letterSpacing: 0.3,
  },
  docMeta: {
    textAlign: 'right',
  },
  docNumber: {
    fontFamily: 'Manrope',
    fontSize: 10,
    fontWeight: 'bold',
    color: BRAND.ink,
    marginBottom: 2,
  },
  docDate: {
    fontSize: 8.5,
    color: BRAND.muted,
  },
  rectifiesLine: {
    fontFamily: 'Lora',
    fontStyle: 'italic',
    fontSize: 8,
    color: BRAND.muted,
    marginTop: 2,
  },
  reasonLine: {
    fontSize: 8,
    color: BRAND.muted,
    marginTop: 1,
  },

  hairline: {
    height: 0.75,
    backgroundColor: BRAND.hairline,
    marginVertical: 14,
  },

  // ── Parties ─────────────────────────────────────────────────────────────
  partiesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start', // buyer block on the left
    marginBottom: 28,
  },
  buyerBlock: {
    width: 220,
  },
  partyLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: BRAND.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 5,
  },
  buyerName: {
    fontFamily: 'Lora',
    fontSize: 10,
    fontWeight: 'bold',
    color: BRAND.ink,
    marginBottom: 2,
  },
  buyerLine: {
    fontSize: 8.5,
    color: BRAND.muted,
    lineHeight: 1.5,
  },
  buyerTaxId: {
    fontSize: 8,
    fontWeight: 'bold',
    color: BRAND.muted,
    marginTop: 2,
    lineHeight: 1.5,
  },

  // ── Line-items table ─────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.beige,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: BRAND.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    borderBottomStyle: 'solid' as const,
  },
  tableRowAlt: {
    backgroundColor: '#fdfcfb',
  },
  colDescription: { flex: 1 },
  colQty: { width: 32, textAlign: 'right' as const },
  colUnit: { width: 72, textAlign: 'right' as const },
  colAmount: { width: 80, textAlign: 'right' as const },
  cellText: {
    fontSize: 9,
    color: BRAND.bodyText,
    lineHeight: 1.4,
  },
  cellMuted: {
    fontSize: 9,
    color: BRAND.muted,
    lineHeight: 1.4,
  },

  // ── Totals ───────────────────────────────────────────────────────────────
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  totalsBlock: {
    width: 240,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: BRAND.muted,
  },
  totalsValue: {
    fontSize: 8.5,
    color: BRAND.bodyText,
    fontWeight: 'bold',
  },
  totalsRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: BRAND.ink,
    borderTopStyle: 'solid' as const,
  },

  // ── Footer (fixed — renders at the bottom of every page) ─────────────────
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 52,
    right: 52,
  },
  footerRule: {
    height: 0.75,
    backgroundColor: BRAND.hairline,
    marginBottom: 12,
  },
  footerMonogram: {
    width: 26,
    height: 'auto' as unknown as number, // react-pdf accepts this at runtime
    alignSelf: 'center',
    marginBottom: 8,
  },
  footerLine: {
    fontSize: 7,
    color: BRAND.muted,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  footerNote: {
    fontFamily: 'Lora',
    fontStyle: 'italic',
    fontSize: 6.5,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  totalLabel: {
    fontFamily: 'Lora',
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND.ink,
  },
  totalValue: {
    fontFamily: 'Lora',
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND.ink,
  },
})

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type InvoiceDocumentProps = {
  number: string
  issuedAt: Date
  type: 'invoice' | 'credit_note'
  correctsNumber?: string
  /** Optional correction reason — only rendered on credit notes. Stored inside
   *  totalsSnapshot.reason (no schema column needed). */
  reason?: string
  // The canonical snapshot/line shapes — a stored-JSON change breaks here at
  // compile time instead of rendering an incomplete PDF.
  sellerSnapshot: SellerSnapshot
  buyerSnapshot: BuyerSnapshot
  totalsSnapshot: TotalsSnapshot
  lines: InvoiceLine[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const {
    number,
    issuedAt,
    type,
    correctsNumber,
    reason,
    sellerSnapshot,
    buyerSnapshot,
    totalsSnapshot,
    lines,
  } = props
  const cur = totalsSnapshot.currency
  const title = type === 'credit_note' ? 'Credit Note' : 'Invoice'

  return (
    <Document
      title={`${title} ${number}`}
      author={sellerSnapshot.legalName}
      creator="The Art Room Gallery"
      producer="@react-pdf/renderer"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header: wordmark + seller block ── */}
        <View style={styles.headerRow} fixed>
          <Image src={WORDMARK_PATH} style={styles.wordmark} />
          <View style={styles.sellerBlock}>
            <Text style={styles.sellerName}>{sellerSnapshot.legalName}</Text>
            {sellerSnapshot.addressLines.map((line, i) => (
              <Text key={i} style={styles.sellerLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.sellerNif}>NIF: {sellerSnapshot.nif}</Text>
            <Text style={styles.sellerLine}>{sellerSnapshot.email}</Text>
            <Text style={styles.sellerLine}>{sellerSnapshot.phone}</Text>
            <Text style={styles.sellerLine}>{sellerSnapshot.website}</Text>
          </View>
        </View>

        {/* ── Red accent rule ── */}
        <View style={styles.redRule} />

        {/* ── Document title + meta ── */}
        <View style={styles.titleRow}>
          <Text style={styles.docType}>{title}</Text>
          <View style={styles.docMeta}>
            <Text style={styles.docNumber}>{number}</Text>
            <Text style={styles.docDate}>{formatDate(issuedAt)}</Text>
            {type === 'credit_note' && correctsNumber ? (
              <Text style={styles.rectifiesLine}>Rectifies {correctsNumber}</Text>
            ) : null}
            {type === 'credit_note' && reason ? (
              <Text style={styles.reasonLine}>Reason: {reason}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.hairline} />

        {/* ── Buyer block (right-aligned) ── */}
        <View style={styles.partiesRow}>
          <View style={styles.buyerBlock}>
            <Text style={styles.partyLabel}>Bill to</Text>
            <Text style={styles.buyerName}>{buyerSnapshot.name}</Text>
            {buyerSnapshot.company ? (
              <Text style={styles.buyerLine}>{buyerSnapshot.company}</Text>
            ) : null}
            {buyerSnapshot.taxId ? (
              <Text style={styles.buyerTaxId}>Tax ID: {buyerSnapshot.taxId}</Text>
            ) : null}
            {buyerSnapshot.addressLines.map((line, i) => (
              <Text key={i} style={styles.buyerLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.buyerLine}>{buyerSnapshot.email}</Text>
          </View>
        </View>

        {/* ── Line-items table ── */}
        <View style={styles.tableHeader}>
          <View style={styles.colDescription}>
            <Text style={styles.tableHeaderCell}>Description</Text>
          </View>
          <View style={styles.colQty}>
            <Text style={styles.tableHeaderCell}>Qty</Text>
          </View>
          <View style={styles.colUnit}>
            <Text style={styles.tableHeaderCell}>Unit price</Text>
          </View>
          <View style={styles.colAmount}>
            <Text style={styles.tableHeaderCell}>Amount</Text>
          </View>
        </View>

        {lines.map((line, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            wrap={false}
          >
            <View style={styles.colDescription}>
              <Text style={styles.cellText}>{line.description}</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.cellMuted}>{line.qty}</Text>
            </View>
            <View style={styles.colUnit}>
              <Text style={styles.cellMuted}>{formatMoney(line.unitCents, cur)}</Text>
            </View>
            <View style={styles.colAmount}>
              <Text style={styles.cellText}>{formatMoney(line.lineCents, cur)}</Text>
            </View>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBlock}>
            <View style={styles.hairline} />

            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Taxable base</Text>
              <Text style={styles.totalsValue}>{formatMoney(totalsSnapshot.baseCents, cur)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>VAT (ES {totalsSnapshot.vatRatePct}%)</Text>
              <Text style={styles.totalsValue}>{formatMoney(totalsSnapshot.vatCents, cur)}</Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.totalsRowTotal}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatMoney(totalsSnapshot.totalCents, cur)}</Text>
            </View>
          </View>
        </View>

        {/* ── Footer — divider, monogram, legal + contact lines. Built from the
              FROZEN sellerSnapshot (never live config) so re-renders of an
              issued document can never change, and rendered `fixed` so it sits
              at the bottom of every page. ── */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <Image src={MONOGRAM_PATH} style={styles.footerMonogram} />
          <Text style={styles.footerLine}>
            {[
              sellerSnapshot.legalName,
              `NIF ${sellerSnapshot.nif}`,
              ...sellerSnapshot.addressLines,
            ].join('  ·  ')}
          </Text>
          <Text style={styles.footerLine}>
            {[sellerSnapshot.email, sellerSnapshot.phone, sellerSnapshot.website]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
          <Text style={styles.footerNote}>
            This {title.toLowerCase()} was issued electronically and is valid without a signature.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
