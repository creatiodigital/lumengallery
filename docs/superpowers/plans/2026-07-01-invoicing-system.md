# Invoicing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The gallery issues its own branded *factura* (PDF) manually from the admin once TPS is in production, stored immutably in R2 + Postgres, viewable per-order and from a dedicated `/admin/invoices` register, and batch-exportable monthly for the accountant.

**Architecture:** New `Invoice` + `InvoiceCounter` Prisma models (append-only). A pure numbering helper produces gap-free, monthly-reset, per-month-series numbers inside one `$transaction`. `@react-pdf/renderer` (already installed) renders an `<InvoiceDocument>` to a Buffer; the buffer is uploaded to a **private** R2 key and emailed to the buyer as an **attachment**. Two admin server actions (`sendInvoice`, `issueCreditNote`) are idempotent and gated on `fulfillmentStatus >= 'Started'`. A new `/admin/invoices` page lists/filters/exports. Everything is behind an off-in-prod feature flag until the gestor signs off.

**Tech Stack:** Next.js (App Router, server actions), Prisma/Postgres (Supabase), Cloudflare R2 (`src/lib/r2.ts`), Resend (`src/lib/emails/`), `@react-pdf/renderer` ^4.5.1, Playwright e2e.

## Global Constraints

- **VAT model (decided 2026-07-01, B2C only):** EU-27 buyer → **21% Spanish VAT**; non-EU buyer (incl. **UK/`GB`**) → **0% export**. No per-country rates. No B2B / reverse-charge / VAT-ID collection. Canary/Ceuta/Melilla 0% is a known edge case, deferred (flag for gestor).
- **Numbering:** `AR-MM-YYYY-NNN` (e.g. `AR-06-2026-001`), sequence zero-padded to 3 digits, **resets monthly**, each `(series, year, month)` is its own correlative gap-free series. Credit notes: `AR-R-MM-YYYY-NNN`.
- **Immutability:** no code path ever updates or deletes an `Invoice` after issue. Snapshots frozen at issue time.
- **No file URLs in emails:** the factura is a PDF **attachment**, never a link (house rule).
- **Private storage:** invoice PDFs are stored under a non-public R2 key and served only through an admin-authenticated download route — never via the public R2 URL.
- **No new dependencies without approval:** CSV export is v1 (no dep). PDF-zip export needs `archiver` → propose + wait for approval before building (Phase 7, optional).
- **Testing = Playwright e2e only** (in `/e2e/`), following the e2e toolkit: headless money-path (no wizard/WebGL), throwaway fixtures, delete every fixture by run end (zero dashboard noise), `SKIP_EMAILS=true` on the runner.
- **UI:** admin controls are **rounded** (dashboard convention); use the `<Button>` component, never native `<button>`. Money is always in **cents**. `var(--token)` only, no fallbacks. No `!important`.
- **Feature flag:** `process.env.INVOICING_ENABLED === 'true'`; **off in prod** until gestor sign-off.
- **Seller legal identity:** The Art Room Gallery, SL · NIF **ESB88838172** · Avenida Guadarrama 4, Bajo B · 28220 Majadahonda · Spain.
- **DB:** edit `schema.prisma` freely, but **never** run `prisma migrate`/`db push` — the user runs `pnpm db:push:dev`. Tasks that change schema must stop and hand off to the user for the push.

---

## File structure

**New files**
- `src/lib/invoices/sellerIdentity.ts` — frozen seller legal identity from env, with hardcoded fallbacks.
- `src/lib/invoices/invoiceNumber.ts` — pure `formatInvoiceNumber()` + series helpers.
- `src/lib/invoices/issueInvoiceRecord.ts` — atomic counter bump + `Invoice` insert (transaction-safe core).
- `src/lib/invoices/InvoiceDocument.tsx` — `@react-pdf/renderer` document component.
- `src/lib/invoices/renderInvoicePdf.ts` — `<InvoiceDocument>` → `Buffer`.
- `src/lib/invoices/assertMandatoryFields.ts` — RD 1619/2012 field guard (throws).
- `src/lib/invoices/buildInvoiceSnapshots.ts` — freeze seller/buyer/totals from a `PrintOrder`.
- `src/lib/invoices/invoiceCsv.ts` — register → CSV string (gestor columns).
- `src/lib/emails/invoice.ts` — `sendInvoiceEmail()` with PDF attachment (mirrors `orderPlaced.ts`).
- `src/app/admin/invoices/page.tsx` — thin wrapper.
- `src/components/admin/invoices/index.tsx` — register table + filters + export.
- `src/app/admin/invoices/actions.ts` — `listInvoices`, `exportInvoiceRegisterCsv`.
- `src/app/admin/invoices/[id]/download/route.ts` — admin-guarded PDF stream from R2.
- `e2e/invoice.spec.ts` — issue → see → export (+ credit note).

**Modified files**
- `prisma/schema.prisma` — `Invoice`, `InvoiceCounter` models; `PrintOrder` += `invoices Invoice[]`, nullable `buyerCompany`, `buyerTaxId` (no UI in v1).
- `src/lib/print-providers/printspace/pricing.ts` — rewrite `getVatRate` to EU-set / 21% / 0%.
- `src/lib/orders/logOrderEvent.ts` — add `'invoice_issued'`, `'credit_note_issued'` kinds.
- `src/app/admin/orders/actions.ts` — `sendInvoice()`, `issueCreditNote()`.
- `src/components/admin/orders/OrderDetail.tsx` — per-order Send/See-invoice button (+ credit-note button in Phase 6).
- `src/lib/r2.ts` — add `uploadPrivateToR2(key, body, contentType)` + `getR2ObjectBuffer(key)`.

---

## Phase 1 — Correct VAT source *(requirement #2)*

Fix the VAT engine once so both the wizard and the invoice inherit the correct rate. Small but load-bearing; do it first so every downstream total is right.

### Task 1: Rewrite `getVatRate` to the decided B2C model

**Files:**
- Modify: `src/lib/print-providers/printspace/pricing.ts:462-498`
- Test: `e2e/vat-rate.spec.ts` (Playwright-as-runner, imports the pure fn)

**Interfaces:**
- Produces: `getVatRate(countryCode: string): number` — `0.21` for EU-27, `0` otherwise. Unchanged signature (callers in `getQuote.ts`, `validateCart.ts`, `createPaymentIntent.ts` keep working).
- Produces: `EU_VAT_COUNTRIES: ReadonlySet<string>`, `HOME_VAT_RATE = 0.21`.

- [ ] **Step 1: Write the failing test**

```ts
// e2e/vat-rate.spec.ts
import { test, expect } from '@playwright/test'
import { getVatRate } from '../src/lib/print-providers/printspace/pricing'

test('EU buyers pay 21% Spanish VAT', () => {
  for (const c of ['ES', 'DE', 'FR', 'IT', 'NL', 'PT', 'IE']) {
    expect(getVatRate(c)).toBeCloseTo(0.21)
  }
})

test('non-EU buyers pay 0% (export), including UK', () => {
  for (const c of ['US', 'GB', 'CH', 'CA', 'AU', 'JP']) {
    expect(getVatRate(c)).toBe(0)
  }
})

test('empty / unknown country is 0%', () => {
  expect(getVatRate('')).toBe(0)
  expect(getVatRate('ZZ')).toBe(0)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm playwright test e2e/vat-rate.spec.ts`
Expected: FAIL — `getVatRate('DE')` currently returns `0.19`, `getVatRate('GB')` returns `0.2`.

- [ ] **Step 3: Replace the rate table + function**

```ts
// pricing.ts — replace TPS_VAT_RATES + getVatRate
export const HOME_VAT_RATE = 0.21 // Spain; gallery is a Spanish seller (B2C, pre-OSS)

// EU-27 (VAT territory). UK excluded (post-Brexit → export).
export const EU_VAT_COUNTRIES: ReadonlySet<string> = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
])

/**
 * Output VAT the gallery (Spanish seller) charges the buyer.
 * B2C, below OSS threshold: EU buyer → 21% Spanish; non-EU → 0% export.
 * Canary/Ceuta/Melilla 0% edge case deferred (flag for gestor).
 */
export function getVatRate(countryCode: string): number {
  if (!countryCode) return 0
  return EU_VAT_COUNTRIES.has(countryCode.toUpperCase()) ? HOME_VAT_RATE : 0
}
```

- [ ] **Step 4: Confirm the tax label reads "ES 21%" for all EU buyers**

Check `getQuote.ts:104-119`. The label is built as `VAT (${country.toUpperCase()} ${rateText})`, which would now print `VAT (DE 21%)`. That is misleading — it's Spanish VAT. Change the label to always show the **seller** jurisdiction:

```ts
// getQuote.ts — where taxLabel is built
taxLabel: vatRate > 0 ? `VAT (ES ${rateText})` : undefined,
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm playwright test e2e/vat-rate.spec.ts`
Expected: PASS.

- [ ] **Step 6: Smoke-check the wizard total end-to-end**

Run: `pnpm dev` (port 3001), open a print checkout, set country to Germany → VAT line shows `VAT (ES 21%)` and total = subtotal × 1.21. Set to USA → no VAT line, total = subtotal.

- [ ] **Step 7: Commit**

```bash
git add src/lib/print-providers/printspace/pricing.ts src/lib/print-providers/printspace/getQuote.ts e2e/vat-rate.spec.ts
git commit -m "fix(AR-131): VAT is 21% Spanish for EU B2C, 0% export (incl UK); label shows ES"
```

---

## Phase 2 — Foundation: models, seller identity, atomic numbering

### Task 2: Prisma models + PrintOrder additions

**Files:**
- Modify: `prisma/schema.prisma` (PrintOrder model ~324-406; add two new models)

**Interfaces:**
- Produces: `Invoice`, `InvoiceCounter` models; `PrintOrder.invoices`, `PrintOrder.buyerCompany?`, `PrintOrder.buyerTaxId?`.

- [ ] **Step 1: Add the models**

```prisma
model Invoice {
  id                String     @id @default(uuid())
  orderId           String
  order             PrintOrder @relation(fields: [orderId], references: [id])
  type              String     // 'invoice' | 'credit_note'
  series            String     // 'AR' | 'AR-R'
  year              Int
  month             Int
  seq               Int
  number            String     @unique // 'AR-06-2026-001'
  correctsInvoiceId String?
  correctsInvoice   Invoice?   @relation("InvoiceCorrections", fields: [correctsInvoiceId], references: [id])
  corrections       Invoice[]  @relation("InvoiceCorrections")
  issuedAt          DateTime   @default(now())
  currency          String     @default("eur")
  r2Key             String     // PRIVATE key (never a public URL)
  sellerSnapshot    Json
  buyerSnapshot     Json
  totalsSnapshot    Json
  createdAt         DateTime   @default(now())

  @@index([year, month])
  @@index([orderId])
}

model InvoiceCounter {
  series     String
  year       Int
  month      Int
  lastNumber Int    @default(0)

  @@id([series, year, month])
}
```

- [ ] **Step 2: Extend PrintOrder**

Add inside the `PrintOrder` model:
```prisma
  buyerCompany String?
  buyerTaxId   String?
  invoices     Invoice[]
```

- [ ] **Step 3: Hand off the DB push to the user**

STOP. Tell the user: "Schema updated — please run `pnpm db:push:dev` and then `pnpm db:generate`." Do not run it yourself. Wait for confirmation before continuing.

- [ ] **Step 4: Commit (schema only)**

```bash
git add prisma/schema.prisma
git commit -m "feat(AR-131): Invoice + InvoiceCounter models; PrintOrder buyer tax fields"
```

### Task 3: Seller identity config

**Files:**
- Create: `src/lib/invoices/sellerIdentity.ts`

**Interfaces:**
- Produces: `SELLER_IDENTITY: { legalName; nif; addressLines: string[]; email; phone; website }`.

- [ ] **Step 1: Write it (env with the real legal identity as fallback)**

```ts
// src/lib/invoices/sellerIdentity.ts
export const SELLER_IDENTITY = {
  legalName: process.env.SELLER_LEGAL_NAME || 'The Art Room Gallery, SL',
  nif: process.env.SELLER_NIF || 'ESB88838172',
  addressLines: (process.env.SELLER_ADDRESS ||
    'Avenida Guadarrama 4, Bajo B|28220 Majadahonda|Spain').split('|'),
  email: process.env.SELLER_EMAIL || 'contact@theartroom.gallery',
  phone: process.env.SELLER_PHONE || '+34 665 05 99 41',
  website: process.env.SELLER_WEBSITE || 'theartroom.gallery',
} as const
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/invoices/sellerIdentity.ts
git commit -m "feat(AR-131): seller legal identity config"
```

### Task 4: Pure numbering helper

**Files:**
- Create: `src/lib/invoices/invoiceNumber.ts`
- Test: `e2e/invoice-number.spec.ts`

**Interfaces:**
- Produces: `seriesFor(type: 'invoice'|'credit_note'): 'AR'|'AR-R'`; `formatInvoiceNumber(series, year, month, seq): string`.

- [ ] **Step 1: Write the failing test**

```ts
// e2e/invoice-number.spec.ts
import { test, expect } from '@playwright/test'
import { formatInvoiceNumber, seriesFor } from '../src/lib/invoices/invoiceNumber'

test('formats AR-MM-YYYY-NNN with zero padding', () => {
  expect(formatInvoiceNumber('AR', 2026, 6, 1)).toBe('AR-06-2026-001')
  expect(formatInvoiceNumber('AR', 2026, 6, 42)).toBe('AR-06-2026-042')
  expect(formatInvoiceNumber('AR', 2026, 12, 7)).toBe('AR-12-2026-007')
})

test('credit-note series', () => {
  expect(seriesFor('credit_note')).toBe('AR-R')
  expect(formatInvoiceNumber('AR-R', 2026, 7, 3)).toBe('AR-R-07-2026-003')
})
```

- [ ] **Step 2: Run it — FAIL** (`pnpm playwright test e2e/invoice-number.spec.ts`)

- [ ] **Step 3: Implement**

```ts
// src/lib/invoices/invoiceNumber.ts
export function seriesFor(type: 'invoice' | 'credit_note'): 'AR' | 'AR-R' {
  return type === 'credit_note' ? 'AR-R' : 'AR'
}

export function formatInvoiceNumber(
  series: string, year: number, month: number, seq: number,
): string {
  const mm = String(month).padStart(2, '0')
  const nnn = String(seq).padStart(3, '0')
  return `${series}-${mm}-${year}-${nnn}`
}
```

- [ ] **Step 4: Run it — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/invoiceNumber.ts e2e/invoice-number.spec.ts
git commit -m "feat(AR-131): pure invoice-number formatter (AR-MM-YYYY-NNN)"
```

### Task 5: Atomic issue-record core (gap-free numbering)

**Files:**
- Create: `src/lib/invoices/issueInvoiceRecord.ts`
- Test: `e2e/invoice-numbering-atomic.spec.ts`

**Interfaces:**
- Consumes: `formatInvoiceNumber`, `seriesFor` (Task 4).
- Produces: `issueInvoiceRecord(input): Promise<Invoice>` where
  `input = { type: 'invoice'|'credit_note'; order: PrintOrder; r2Key: string; snapshots: { sellerSnapshot; buyerSnapshot; totalsSnapshot }; correctsInvoiceId?: string; now?: Date }`.

- [ ] **Step 1: Implement the transactional counter + insert**

```ts
// src/lib/invoices/issueInvoiceRecord.ts
import { prisma } from '@/lib/prisma' // match the project's Prisma client import
import { formatInvoiceNumber, seriesFor } from './invoiceNumber'

type IssueInput = {
  type: 'invoice' | 'credit_note'
  orderId: string
  currency: string
  r2Key: string
  sellerSnapshot: unknown
  buyerSnapshot: unknown
  totalsSnapshot: unknown
  correctsInvoiceId?: string
  now?: Date
}

export async function issueInvoiceRecord(input: IssueInput) {
  const now = input.now ?? new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const series = seriesFor(input.type)

  return prisma.$transaction(async (tx) => {
    const counter = await tx.invoiceCounter.upsert({
      where: { series_year_month: { series, year, month } },
      create: { series, year, month, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const seq = counter.lastNumber
    const number = formatInvoiceNumber(series, year, month, seq)

    return tx.invoice.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        series, year, month, seq, number,
        correctsInvoiceId: input.correctsInvoiceId ?? null,
        issuedAt: now,
        currency: input.currency,
        r2Key: input.r2Key,
        sellerSnapshot: input.sellerSnapshot as object,
        buyerSnapshot: input.buyerSnapshot as object,
        totalsSnapshot: input.totalsSnapshot as object,
      },
    })
  })
}
```

- [ ] **Step 2: Write an e2e that issues 5 records concurrently and asserts no gaps/dupes**

```ts
// e2e/invoice-numbering-atomic.spec.ts
import { test, expect } from '@playwright/test'
import { issueInvoiceRecord } from '../src/lib/invoices/issueInvoiceRecord'
import { makeThrowawayOrder, deleteOrder } from './order-helpers' // reuse toolkit

test('concurrent issues are gap-free and unique', async () => {
  const order = await makeThrowawayOrder()
  const now = new Date(Date.UTC(2099, 0, 15)) // isolated period, no collision
  const results = await Promise.all(
    Array.from({ length: 5 }, () => issueInvoiceRecord({
      type: 'invoice', orderId: order.id, currency: 'eur', r2Key: 'test',
      sellerSnapshot: {}, buyerSnapshot: {}, totalsSnapshot: {}, now,
    })),
  )
  const seqs = results.map((r) => r.seq).sort((a, b) => a - b)
  expect(seqs).toEqual([1, 2, 3, 4, 5]) // no gaps, no dupes
  await deleteOrder(order.id) // zero dashboard noise
})
```

Note: if `makeThrowawayOrder`/`deleteOrder` don't exist under those names, use the actual helpers from `reference_e2e_helper_toolkit` / `e2e/order-helpers.ts`. Delete every `Invoice`/`InvoiceCounter` row created for the `2099-01` period in teardown.

- [ ] **Step 3: Run it — PASS** (`pnpm playwright test e2e/invoice-numbering-atomic.spec.ts`)

- [ ] **Step 4: Commit**

```bash
git add src/lib/invoices/issueInvoiceRecord.ts e2e/invoice-numbering-atomic.spec.ts
git commit -m "feat(AR-131): atomic gap-free invoice numbering in a transaction"
```

### Task 5b: Dev-only numbering reset (for local testing)

**Files:**
- Create: `scripts/reset-invoicing.ts`

**Why:** local manual testing needs to restart numbering at `001` and clear test facturas without touching prod.

**Interfaces:**
- Produces: a runnable script `pnpm tsx scripts/reset-invoicing.ts [--month MM-YYYY | --all]`.

- [ ] **Step 1: Implement with a hard prod guard**

```ts
// scripts/reset-invoicing.ts — DEV/LOCAL ONLY
import { prisma } from '@/lib/prisma'
import { getR2ObjectBuffer } from '@/lib/r2' // + a delete helper

async function main() {
  if (process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    throw new Error('reset-invoicing is blocked in production')
  }
  // Optional scope: --month 07-2026 resets one period; --all wipes every test invoice.
  const invoices = await prisma.invoice.findMany()
  // 1. delete each invoice's PDF from R2 (deleteR2KeyDirect(inv.r2Key))
  // 2. prisma.invoice.deleteMany(...)  3. prisma.invoiceCounter.deleteMany(...)
  console.log(`Reset ${invoices.length} invoices; counters cleared → next issue is 001`)
}
main()
```

Deleting the `InvoiceCounter` row(s) makes the next issue start at `001` again.

- [ ] **Step 2: ⚠️ Note the shared-DB caveat in the script header** — local + staging share the dev DB (per `project_staging_setup`), so `--all` wipes staging's test facturas too. Default to `--month` scope; require `--all` to be explicit. This is a **dev tool**, never wired into the app or prod (the immutability rule still holds for real invoices — this bypasses it deliberately, for test data only).

- [ ] **Step 3: Commit** (`git commit -m "chore(AR-131): dev-only invoicing reset script"`)

---

## Phase 3 — The PDF template *(requirement #1)*

### Task 6: Snapshot builder + mandatory-field guard

**Files:**
- Create: `src/lib/invoices/buildInvoiceSnapshots.ts`, `src/lib/invoices/assertMandatoryFields.ts`
- Test: `e2e/invoice-snapshots.spec.ts`

**Interfaces:**
- Produces: `buildInvoiceSnapshots(order, { negate?: boolean }): { sellerSnapshot; buyerSnapshot; totalsSnapshot }`.
- Produces: `assertMandatoryFields(snapshots): void` (throws `Error` with the missing field).

- [ ] **Step 1: Implement snapshots (freeze from the order + seller identity)**

```ts
// src/lib/invoices/buildInvoiceSnapshots.ts
import { SELLER_IDENTITY } from './sellerIdentity'

export function buildInvoiceSnapshots(order: any, opts: { negate?: boolean } = {}) {
  const sign = opts.negate ? -1 : 1
  const addr = order.shippingAddress ?? {}
  const baseCents = order.totalCents - order.customerVatCents
  return {
    sellerSnapshot: { ...SELLER_IDENTITY },
    buyerSnapshot: {
      name: order.buyerName,
      email: order.buyerEmail,
      company: order.buyerCompany ?? null,
      taxId: order.buyerTaxId ?? null,
      addressLines: [addr.address1, addr.address2, `${addr.postalCode} ${addr.city}`, addr.stateOrRegion, addr.countryCode]
        .filter(Boolean),
      countryCode: order.country,
    },
    totalsSnapshot: {
      currency: order.currency,
      baseCents: baseCents * sign,
      vatRatePct: order.customerVatCents > 0 ? 21 : 0,
      vatCents: order.customerVatCents * sign,
      totalCents: order.totalCents * sign,
    },
  }
}
```

- [ ] **Step 2: Implement the mandatory-field guard (RD 1619/2012)**

```ts
// src/lib/invoices/assertMandatoryFields.ts
export function assertMandatoryFields(s: {
  sellerSnapshot: any; buyerSnapshot: any; totalsSnapshot: any
}): void {
  const req = (cond: boolean, field: string) => {
    if (!cond) throw new Error(`Invoice missing mandatory field: ${field}`)
  }
  req(!!s.sellerSnapshot?.legalName, 'seller.legalName')
  req(!!s.sellerSnapshot?.nif, 'seller.nif')
  req((s.sellerSnapshot?.addressLines?.length ?? 0) > 0, 'seller.address')
  req(!!s.buyerSnapshot?.name, 'buyer.name')
  req((s.buyerSnapshot?.addressLines?.length ?? 0) > 0, 'buyer.address')
  req(typeof s.totalsSnapshot?.baseCents === 'number', 'totals.baseCents')
  req(typeof s.totalsSnapshot?.vatCents === 'number', 'totals.vatCents')
  req(typeof s.totalsSnapshot?.totalCents === 'number', 'totals.totalCents')
}
```

- [ ] **Step 3: Test both** (`e2e/invoice-snapshots.spec.ts`): a complete order passes; an order with a blank `buyerName` throws `buyer.name`; credit-note snapshots are the exact negative of the invoice. Run → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/invoices/buildInvoiceSnapshots.ts src/lib/invoices/assertMandatoryFields.ts e2e/invoice-snapshots.spec.ts
git commit -m "feat(AR-131): invoice snapshots + mandatory-field guard"
```

### Task 7: `<InvoiceDocument>` + `renderInvoicePdf`

**Files:**
- Create: `src/lib/invoices/InvoiceDocument.tsx`, `src/lib/invoices/renderInvoicePdf.ts`

**Interfaces:**
- Consumes: the snapshot shape from Task 6, `number`, `issuedAt`, optional `correctsNumber`.
- Produces: `renderInvoicePdf(input): Promise<Buffer>`.

- [ ] **Step 1: Register the brand fonts**

`@react-pdf/renderer` needs actual font files (not a CSS stack). Register the gallery's brand serif + sans (TTF/OTF) via `Font.register({ family, src })` — reuse the same font files the branded email/site use so the factura matches. Register once at module scope in `InvoiceDocument.tsx`.

```ts
import { Font } from '@react-pdf/renderer'
Font.register({ family: 'BrandSerif', src: `${SITE_URL}/fonts/<brand-serif>.ttf` })
Font.register({ family: 'BrandSans',  src: `${SITE_URL}/fonts/<brand-sans>.ttf` })
```

- [ ] **Step 2: Build the document (branded layout, all mandatory fields)**

Use `@react-pdf/renderer` primitives (`Document, Page, View, Text, Image, StyleSheet`). Pull brand colours/asset URLs from `src/lib/emails/brand.ts` (`EMAIL_BRAND` → `wordmarkUrl`, `monogramUrl`). **Layout per user spec:**
- **Top:** the **main logo (wordmark)** — `EMAIL_BRAND.wordmarkUrl` — as the header, with `SELLER_IDENTITY` (legal name, NIF, address) beneath or beside it.
- **Body:** invoice number + issue date (+ "Rectifies AR-…" line when `correctsNumber` present); buyer block; per-line items (from `order.items` or the legacy single line via `printConfig`); then **base / VAT (rate% + amount) / total**. Amounts via a cents→currency formatter. Typography uses the registered brand fonts (serif for headings, sans for figures/labels).
- **Very bottom, centered:** the **monogram** — `EMAIL_BRAND.monogramUrl` — as a small centered footer mark (use a fixed-position footer `View` so it sits at the page bottom on every page).

```ts
// src/lib/invoices/renderInvoicePdf.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoiceDocument } from './InvoiceDocument'

export async function renderInvoicePdf(input: {
  number: string; issuedAt: Date; type: 'invoice' | 'credit_note'
  correctsNumber?: string
  sellerSnapshot: any; buyerSnapshot: any; totalsSnapshot: any
  lines: Array<{ description: string; qty: number; unitCents: number; lineCents: number }>
}): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...input} />)
}
```

- [ ] **Step 3: Preview it during dev**

Add a temporary dev-only route or script that writes `renderInvoicePdf(fixture)` to `scratchpad/sample-factura.pdf`; open it and eyeball layout + that every mandatory field renders. (Remove the temp route before committing, or guard it behind `INVOICING_ENABLED`.)

- [ ] **Step 4: e2e smoke** — `renderInvoicePdf(fixture)` returns a Buffer whose first bytes are `%PDF`. Run → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/InvoiceDocument.tsx src/lib/invoices/renderInvoicePdf.ts e2e/invoice-pdf.spec.ts
git commit -m "feat(AR-131): branded InvoiceDocument + renderInvoicePdf"
```

---

## Phase 4 — Issue + send + per-order button *(requirement #3)*

### Task 8: Private R2 helpers

**Files:**
- Modify: `src/lib/r2.ts` (add two functions near `uploadToR2`)

**Interfaces:**
- Produces: `uploadPrivateToR2(key, body, contentType): Promise<void>` (no public URL returned); `getR2ObjectBuffer(key): Promise<Buffer>`.

- [ ] **Step 1: Implement** using the existing S3 client in `r2.ts` (`PutObjectCommand` without public-cache headers; `GetObjectCommand` streamed to a Buffer). Key pattern: `${env}/invoices/${orderId}/${number}.pdf`.

- [ ] **Step 2: e2e** — upload a small buffer to a `test/invoices/…` key, read it back, assert equality, delete it. Run → PASS.

- [ ] **Step 3: Commit** (`git commit -m "feat(AR-131): private R2 upload + fetch helpers for invoices"`)

### Task 9: `sendInvoiceEmail` (attachment)

**Files:**
- Create: `src/lib/emails/invoice.ts` (mirror `src/lib/emails/orderPlaced.ts`)

**Interfaces:**
- Produces: `sendInvoiceEmail(args: { to; buyerName; number; pdf: Buffer; isCreditNote?: boolean }): Promise<{ ok: true; id: string } | { ok: false; error: string }>`.

- [ ] **Step 1: Implement** — reuse `renderEmailLayout`/`emailHeader`/`emailFooter`/`emailParagraph`. Body: "Please find attached your invoice `AR-…`." Send via Resend with `attachments: [{ filename: '${number}.pdf', content: pdf, contentType: 'application/pdf' }]`. Respect `SKIP_EMAILS` exactly like the other senders (return `{ ok: true, id: 'skipped' }`).

- [ ] **Step 2: Commit** (`git commit -m "feat(AR-131): invoice email with PDF attachment"`)

### Task 10: `sendInvoice` server action (idempotent, gated)

**Files:**
- Modify: `src/app/admin/orders/actions.ts`, `src/lib/orders/logOrderEvent.ts`

**Interfaces:**
- Consumes: `issueInvoiceRecord`, `buildInvoiceSnapshots`, `assertMandatoryFields`, `renderInvoicePdf`, `uploadPrivateToR2`, `sendInvoiceEmail`.
- Produces: `sendInvoice(orderId: string): Promise<{ ok: true; number: string } | { ok: false; error: string }>`.

- [ ] **Step 1: Add event kinds** to `logOrderEvent.ts` union: `'invoice_issued'`, `'credit_note_issued'`.

- [ ] **Step 2: Implement `sendInvoice`** with the exact ordering:
  1. Admin session guard (match `capturePayment`'s guard).
  2. Load order + `order.invoices`. If `fulfillmentStatus` not in `['Started','Shipped','Complete']` → `{ ok:false, error:'Invoice available once TPS starts production.' }`.
  3. **Idempotent:** if an `Invoice` of `type:'invoice'` exists → re-render from its snapshots, re-upload if missing, re-email, return its `number` (never mint a second).
  4. Else: `buildInvoiceSnapshots(order)` → `assertMandatoryFields` → `issueInvoiceRecord(...)` (assigns number) → `renderInvoicePdf` → `uploadPrivateToR2` → `sendInvoiceEmail`.
  5. `logOrderEvent({ kind:'invoice_issued', actor:'admin:<id>', message: number })` and `email_sent`/`email_failed` for the send.
  6. **Number-burn rule:** the number is committed with the record in step 4's transaction; a later render/email failure does **not** roll it back — the record exists and re-send reuses it. (Do not put render/email inside the numbering `$transaction`.)

- [ ] **Step 3: e2e (headless money-path)** — create throwaway order → advance to `Started` → `sendInvoice` → assert `{ok:true, number: /^AR-\d{2}-\d{4}-\d{3}$/}`, an `invoice_issued` event exists, and a second `sendInvoice` returns the **same** number. Delete the order + invoice rows in teardown. Run → PASS.

- [ ] **Step 4: Commit** (`git commit -m "feat(AR-131): sendInvoice action — gated, idempotent, gap-free"`)

### Task 11: Per-order button on `OrderDetail`

**Files:**
- Modify: `src/components/admin/orders/OrderDetail.tsx`

- [ ] **Step 1: Add the button block** near the existing fulfillment actions:
  - If no invoice yet AND `fulfillmentStatus >= 'Started'` → `<Button variant="primary" label="Send invoice">` → opens `ConfirmModal` ("Issue and email the factura to the buyer?") → calls `sendInvoice`.
  - If an invoice exists → show its number + `<Button variant="secondary" label="See invoice">` linking to `/admin/invoices/<id>/download`.
  - Before `Started` → hint text: "Invoice unlocks when TPS starts production."
  Follow the existing `busy`/`showConfirm` pattern documented in the codebase.

- [ ] **Step 2: Manual verify** in `pnpm dev`: an order in `Started` shows Send invoice; after sending, it flips to "See invoice" + number; clicking downloads the PDF.

- [ ] **Step 3: Commit** (`git commit -m "feat(AR-131): per-order Send/See-invoice button"`)

---

## Phase 5 — Invoices register page *(requirement #4)*

### Task 12: Admin-guarded PDF download route

**Files:**
- Create: `src/app/admin/invoices/[id]/download/route.ts`

- [ ] **Step 1: Implement** a `GET` handler: admin session guard → load `Invoice` by id → `getR2ObjectBuffer(invoice.r2Key)` → return with `Content-Type: application/pdf` and `Content-Disposition: inline; filename="<number>.pdf"`. 401 for non-admins.

- [ ] **Step 2: e2e** — issue an invoice, GET the route as admin → 200 + `%PDF`; as non-admin → 401. Run → PASS.

- [ ] **Step 3: Commit** (`git commit -m "feat(AR-131): admin-guarded invoice PDF download"`)

### Task 13: `listInvoices` + register page

**Files:**
- Create: `src/app/admin/invoices/page.tsx`, `src/components/admin/invoices/index.tsx`, `src/app/admin/invoices/actions.ts`

**Interfaces:**
- Produces: `listInvoices({ year?, month? }): Promise<InvoiceRow[]>` where `InvoiceRow = { id; number; type; issuedAt; buyerName; baseCents; vatCents; totalCents; currency; orderId }`.

- [ ] **Step 1: Implement `listInvoices`** — query `Invoice` filtered by optional `year`/`month`, ordered by `series, year, month, seq` (correlative). Map snapshots → row fields.

- [ ] **Step 2: Build the page** — thin `page.tsx` wrapper (mirror `admin/orders/page.tsx`) → `<AdminInvoices />` client component: month + year `SelectDropdown` filters, a table (number, type, date, buyer, base, VAT, total, download link), "Export CSV" button. Admin rounded styling; `<Button>` only.

- [ ] **Step 3: e2e** — issue two invoices in a fixed test period → open `/admin/invoices` filtered to that month → both listed in correlative order with correct totals. Teardown deletes them. Run → PASS.

- [ ] **Step 4: Commit** (`git commit -m "feat(AR-131): /admin/invoices register page + listInvoices"`)

### Task 14: CSV export (v1, no new dep)

**Files:**
- Create: `src/lib/invoices/invoiceCsv.ts`; add `exportInvoiceRegisterCsv` to `src/app/admin/invoices/actions.ts`

**Interfaces:**
- Produces: `invoiceRegisterToCsv(rows: InvoiceRow[]): string` (gestor columns: Number, Type, Issue date, Buyer, Tax ID, Base (€), VAT % , VAT (€), Total (€), Currency, Order).

- [ ] **Step 1: Implement** the CSV serializer (escape quotes/commas; cents→decimal euros). `exportInvoiceRegisterCsv({year, month})` returns `{ filename: 'AR-register-2026-06.csv', csv }`.

- [ ] **Step 2: Wire the "Export CSV" button** to download the string as a file.

- [ ] **Step 3: e2e** — issue two invoices → export the month → CSV contains both numbers + correct euro totals. Run → PASS.

- [ ] **Step 4: Commit** (`git commit -m "feat(AR-131): monthly CSV register export"`)

---

## Phase 6 — Credit notes *(refunds → factura rectificativa; self-contained, skippable)*

### Task 15: `issueCreditNote` action + button

**Files:**
- Modify: `src/app/admin/orders/actions.ts`, `src/components/admin/orders/OrderDetail.tsx`

**Interfaces:**
- Produces: `issueCreditNote(orderId): Promise<{ ok:true; number:string } | { ok:false; error:string }>`.

- [ ] **Step 1: Implement** — guard requires an existing `type:'invoice'` invoice **and** `paymentStatus === 'refunded'`. Idempotent (re-send existing credit note). Else: `buildInvoiceSnapshots(order, { negate:true })` → `assertMandatoryFields` → `issueInvoiceRecord({ type:'credit_note', correctsInvoiceId: originalId })` (series `AR-R`) → render (with `correctsNumber` = original number + reason) → private R2 → email attachment → `logOrderEvent('credit_note_issued')`.

- [ ] **Step 2: Button** — on `OrderDetail`, when order is refunded AND an invoice exists → `<Button variant="danger" label="Issue credit note">` (ConfirmModal). After issue → "See credit note" + `AR-R-…` number.

- [ ] **Step 3: e2e** — order → Started → invoice → refund → issue credit note → register shows both, credit-note totals are exact negatives, CSV export contains both rows. Run → PASS.

- [ ] **Step 4: Commit** (`git commit -m "feat(AR-131): credit notes (factura rectificativa)"`)

---

## Phase 7 — Compliance gate + optional PDF-zip

### Task 16: Feature flag (off in prod until gestor sign-off)

**Files:**
- Modify: `src/app/admin/orders/actions.ts`, `src/app/admin/invoices/actions.ts`, `OrderDetail.tsx`, `src/components/admin/invoices/index.tsx`

- [ ] **Step 1:** Guard every issue/send path and the `/admin/invoices` UI behind `process.env.INVOICING_ENABLED === 'true'`. When off: `sendInvoice`/`issueCreditNote` return `{ ok:false, error:'Invoicing is not enabled yet.' }` and the buttons/page are hidden. Leave it **unset in prod** until the gestor signs off on a sample factura + rectificativa + CSV.

- [ ] **Step 2: Commit** (`git commit -m "feat(AR-131): gate invoicing behind INVOICING_ENABLED"`)

### Task 17 (OPTIONAL — needs package approval): PDF-zip batch export

- [ ] **Step 1:** Propose `archiver` to the user and **wait for approval** (no-unsanctioned-packages rule). Do not install otherwise.
- [ ] **Step 2 (after approval):** add "Export PDFs (zip)" that streams the month's PDFs from R2 into a zip. e2e: zip contains one entry per invoice in the period.

---

## Self-review

- **Spec coverage:** #1 templates → Phase 3; #2 correct VAT (wizard + invoice) → Phase 1 + snapshots render `customerVatCents`; #3 manual click gated on TPS production → Task 10/11; #4 saved/organized/filter/export/batch + separate page → Phase 5 (+ Phase 7 zip); credit notes → Phase 6; immutable durable storage → private R2 + append-only model; compliance gate → Task 16.
- **Placeholder scan:** load-bearing logic (VAT, numbering, snapshots, guard, sendInvoice ordering, CSV) has concrete code; UI tasks reference the codebase's documented `<Button>`/`ConfirmModal`/table patterns rather than restating them.
- **Type consistency:** `getVatRate` signature unchanged; `issueInvoiceRecord` input reused by `sendInvoice` + `issueCreditNote`; `InvoiceRow` shared by `listInvoices` + `invoiceRegisterToCsv`; event kinds `invoice_issued`/`credit_note_issued` added once and used consistently.

## Open items to confirm before prod enablement

1. **TPS shipping origin** (customs / dispatch country) — separate from output VAT, but confirm before go-live (tracked in the VAT memory).
2. **Gestor sign-off** on sample factura + rectificativa + CSV format (Task 16 gate).
3. **Canary/Ceuta/Melilla 0%** — deferred edge case; add postal-code check if the gallery ships there.
4. **`archiver` approval** for the PDF-zip export (Task 17).
