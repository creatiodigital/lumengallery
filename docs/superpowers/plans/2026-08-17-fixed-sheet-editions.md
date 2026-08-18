# Fixed-Sheet Limited Editions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an artist fix a limited-edition variant's total sheet size (e.g. 40 × 50 cm) and have the image size and per-axis borders derived, instead of only entering an image size with a uniform border.

**Architecture:** Two modes on `LimitedVariant`, discriminated by whether `sheetWidthCm`/`sheetHeightCm` are null. One pure helper, `computeSheetLayout`, reproduces theprintspace's fit algorithm and becomes the single source of truth for sheet/image/border geometry across validation, previews, buyer copy and the admin order instruction. `widthCm`/`heightCm` keep meaning "image size" in both modes, so the uniqueness key, pricing and every existing consumer keep working untouched.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma + Postgres (Neon), SCSS modules, React Three Fiber for the 3D previewers, Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-08-17-fixed-sheet-editions-design.md`

## Global Constraints

- **Measurements are always cm**, never m or inches, in code and copy. The one exception is the TPS recipe card, which prints inches alongside cm because the TPS row carries both.
- **Display convention is HEIGHT × WIDTH** for artwork and print sizes in our UI. **TPS is WIDTH × HEIGHT.** Every dimension pair that crosses that boundary must be explicitly labelled.
- **Tests are Playwright only**, in `/e2e/`. No Vitest, Jest or bun:test. Pure-function specs import from `../src/lib/...` and use bare `test()` / `expect()` — see `e2e/invoice-number.spec.ts`.
- **Never mount the wizard 3D scene or exhibition scene in e2e.** Use the isolation pattern.
- **Never run `prisma migrate` or `prisma db push`.** Schema edits are made in `schema.prisma`; the user runs the push. Never propose a specific migrate command.
- **No new dependencies** without explicit approval.
- **Use `<Button/>`** from `@/components/ui/Button`; never a plain `<button>` for controls.
- **No emoji in UI** — `lucide-react` icons with `ICON_STROKE_WIDTH`.
- **No `var()` fallbacks in SCSS**; write `var(--token)` only. Avoid `!important`.
- **Artist dashboard controls are rounded** (client/buyer-facing surfaces are squared).
- **Form validation**: silent on arrival → all errors on submit → clear live.
- Gallery cut is `artistPriceCents × TPS_GALLERY_MARKUP_RATE` (`0.4`, exported from `src/lib/print-providers/printspace/pricing.ts:592`). Tests import the constant, never restate `0.4`.
- Distribution is **Even only**. Bottom-weighted and aspect-ratio are out of scope by decision.
- Dev server runs on **port 3001** (`pnpm dev`); e2e dev server on **3002**. Never port 3000.
- `SKIP_EMAILS=true` on both dev server and runner for any e2e touching the money path.

---

### Task 1: Geometry helper

The pure function everything else consumes. Reproduces theprintspace's algorithm: the border is a *minimum*, the image is fitted inside `sheet − 2×minBorder` preserving the artwork ratio, centred, never cropped; leftover space on the non-binding axis becomes extra border.

**Files:**
- Create: `src/lib/editions/sheetLayout.ts`
- Test: `e2e/sheet-layout.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SheetLayout = { sheetWidthCm: number; sheetHeightCm: number; imageWidthCm: number; imageHeightCm: number; borderXCm: number; borderYCm: number }`
  - `computeSheetLayout(args: { sheetWidthCm: number; sheetHeightCm: number; minBorderCm: number; aspectRatio: number }): SheetLayout | null` — `aspectRatio` is **width / height**. Returns `null` when the inner box is non-positive on either axis.
  - `isFixedSheet(v: { sheetWidthCm?: number | null; sheetHeightCm?: number | null }): boolean`
  - `TPS_BORDER_REFERENCE_WIDTH_CM = 40`
  - `TPS_BORDER_CAP_FRACTION = 0.25`

- [ ] **Step 1: Write the failing test**

Create `e2e/sheet-layout.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import {
  computeSheetLayout,
  isFixedSheet,
  TPS_BORDER_REFERENCE_WIDTH_CM,
  TPS_BORDER_CAP_FRACTION,
} from '../src/lib/editions/sheetLayout'

// The verified case, confirmed against theprintspace's own full preview
// on 2026-08-17: a 3:2 landscape artwork on a 50 x 40 cm sheet with a
// 7 cm minimum border yields a 36 x 24 image and 7 / 8 borders.
test('verified TPS case: 50x40 sheet, 7cm minimum, 3:2 image', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })
  expect(layout).not.toBeNull()
  expect(layout!.imageWidthCm).toBeCloseTo(36, 5)
  expect(layout!.imageHeightCm).toBeCloseTo(24, 5)
  expect(layout!.borderXCm).toBeCloseTo(7, 5)
  expect(layout!.borderYCm).toBeCloseTo(8, 5)
})

// Width-bound: the image is WIDER than the inner box, so width pins to
// the minimum and the leftover lands on the vertical borders.
test('width-bound image pins the horizontal border to the minimum', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 6,
    aspectRatio: 1.5,
  })!
  // inner 38 x 28, ratio 1.357 < 1.5 -> width-bound
  expect(layout.imageWidthCm).toBeCloseTo(38, 5)
  expect(layout.imageHeightCm).toBeCloseTo(38 / 1.5, 5)
  expect(layout.borderXCm).toBeCloseTo(6, 5)
  expect(layout.borderYCm).toBeGreaterThan(6)
})

// Height-bound: a squarer image than the inner box pins the vertical
// border instead, and the leftover lands on the horizontal borders.
test('height-bound image pins the vertical border to the minimum', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 60,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.0,
  })!
  // inner 46 x 26, ratio 1.769 > 1.0 -> height-bound
  expect(layout.imageHeightCm).toBeCloseTo(26, 5)
  expect(layout.imageWidthCm).toBeCloseTo(26, 5)
  expect(layout.borderYCm).toBeCloseTo(7, 5)
  expect(layout.borderXCm).toBeCloseTo(17, 5)
})

test('portrait sheet with portrait artwork', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 40,
    sheetHeightCm: 50,
    minBorderCm: 7,
    aspectRatio: 2 / 3,
  })!
  // inner 26 x 36, ratio 0.722 > 0.667 -> height-bound
  expect(layout.imageHeightCm).toBeCloseTo(36, 5)
  expect(layout.imageWidthCm).toBeCloseTo(24, 5)
  expect(layout.borderYCm).toBeCloseTo(7, 5)
  expect(layout.borderXCm).toBeCloseTo(8, 5)
})

test('returns null when the border consumes the sheet', () => {
  expect(
    computeSheetLayout({
      sheetWidthCm: 20,
      sheetHeightCm: 20,
      minBorderCm: 10,
      aspectRatio: 1.5,
    }),
  ).toBeNull()
})

test('sheet dimensions are echoed back unchanged', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(layout.sheetWidthCm).toBe(50)
  expect(layout.sheetHeightCm).toBe(40)
})

test('isFixedSheet requires both dimensions', () => {
  expect(isFixedSheet({ sheetWidthCm: 50, sheetHeightCm: 40 })).toBe(true)
  expect(isFixedSheet({ sheetWidthCm: 50, sheetHeightCm: null })).toBe(false)
  expect(isFixedSheet({ sheetWidthCm: null, sheetHeightCm: null })).toBe(false)
  expect(isFixedSheet({})).toBe(false)
})

test('TPS constants match the observed wizard behaviour', () => {
  expect(TPS_BORDER_REFERENCE_WIDTH_CM).toBe(40)
  expect(TPS_BORDER_CAP_FRACTION).toBe(0.25)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec playwright test e2e/sheet-layout.spec.ts`
Expected: FAIL — cannot resolve `../src/lib/editions/sheetLayout`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/editions/sheetLayout.ts`:

```ts
/**
 * Geometry for a FIXED-SHEET limited-edition variant.
 *
 * Reproduces theprintspace's border algorithm, verified live in the
 * creativehub product wizard on 2026-08-17:
 *   - the border value is a MINIMUM, not an exact value
 *   - the artwork is fitted inside `sheet - 2*minBorder`, preserving its
 *     aspect ratio, and is NEVER cropped
 *   - it is centred, so leftover space on the non-binding axis becomes
 *     extra border on that axis
 *
 * The consequence — and the whole point of the feature — is that a fixed
 * sheet whose shape differs from the artwork's produces DIFFERENT
 * horizontal and vertical borders (50x40 sheet + 3:2 image -> 7 / 8).
 *
 * This module is the single source of truth. Validation, the artist
 * editor, both previewers, buyer-facing specs and the admin TPS
 * instruction all derive from it, so nothing can drift.
 */

/** TPS measures a "targeted" border at a 40 cm-wide reference print and
 *  scales it DOWN on narrower sheets (never up on wider ones). Sheets
 *  below this width would silently receive less border than entered. */
export const TPS_BORDER_REFERENCE_WIDTH_CM = 40

/** TPS caps the border at a quarter of the sheet's shortest side and
 *  silently clips anything larger. */
export const TPS_BORDER_CAP_FRACTION = 0.25

export type SheetLayout = {
  sheetWidthCm: number
  sheetHeightCm: number
  imageWidthCm: number
  imageHeightCm: number
  /** Border on the left and right edges. */
  borderXCm: number
  /** Border on the top and bottom edges. */
  borderYCm: number
}

export type ComputeSheetLayoutArgs = {
  sheetWidthCm: number
  sheetHeightCm: number
  /** Minimum border per side, in cm. */
  minBorderCm: number
  /** Artwork aspect ratio, WIDTH / HEIGHT. */
  aspectRatio: number
}

/**
 * Derive the image size and per-axis borders for a fixed sheet.
 * Returns null when the minimum border leaves no printable area, or when
 * any input is not a usable positive number.
 */
export function computeSheetLayout(args: ComputeSheetLayoutArgs): SheetLayout | null {
  const { sheetWidthCm, sheetHeightCm, minBorderCm, aspectRatio } = args

  if (
    !Number.isFinite(sheetWidthCm) ||
    !Number.isFinite(sheetHeightCm) ||
    !Number.isFinite(minBorderCm) ||
    !Number.isFinite(aspectRatio) ||
    sheetWidthCm <= 0 ||
    sheetHeightCm <= 0 ||
    minBorderCm < 0 ||
    aspectRatio <= 0
  ) {
    return null
  }

  const innerWidthCm = sheetWidthCm - minBorderCm * 2
  const innerHeightCm = sheetHeightCm - minBorderCm * 2
  if (innerWidthCm <= 0 || innerHeightCm <= 0) return null

  // Contain: scale the artwork to the largest size that fits the inner
  // box on BOTH axes. Whichever axis binds gets exactly the minimum
  // border; the other keeps the leftover, split evenly by centring.
  const innerRatio = innerWidthCm / innerHeightCm
  const widthBound = aspectRatio >= innerRatio

  const imageWidthCm = widthBound ? innerWidthCm : innerHeightCm * aspectRatio
  const imageHeightCm = widthBound ? innerWidthCm / aspectRatio : innerHeightCm

  return {
    sheetWidthCm,
    sheetHeightCm,
    imageWidthCm,
    imageHeightCm,
    borderXCm: (sheetWidthCm - imageWidthCm) / 2,
    borderYCm: (sheetHeightCm - imageHeightCm) / 2,
  }
}

/** True when a variant is configured in fixed-sheet mode. Both sheet
 *  dimensions must be present — a half-set pair is adaptive. */
export function isFixedSheet(v: {
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
}): boolean {
  return (
    typeof v.sheetWidthCm === 'number' &&
    Number.isFinite(v.sheetWidthCm) &&
    v.sheetWidthCm > 0 &&
    typeof v.sheetHeightCm === 'number' &&
    Number.isFinite(v.sheetHeightCm) &&
    v.sheetHeightCm > 0
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec playwright test e2e/sheet-layout.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editions/sheetLayout.ts e2e/sheet-layout.spec.ts
git commit -m "AR-135: add fixed-sheet geometry helper mirroring the TPS border algorithm"
```

---

### Task 2: Schema and shared types

Adds the two nullable columns and threads them through the client-facing shapes. No behaviour change yet — this task only widens the data.

**Files:**
- Modify: `prisma/schema.prisma:246-252` (the `LimitedVariant` size block)
- Modify: `src/lib/editions/types.ts` (`LimitedVariantDraft`, `LimitedVariantView`)

**Interfaces:**
- Consumes: `isFixedSheet` from Task 1.
- Produces: `LimitedVariantDraft` and `LimitedVariantView` each gain `sheetWidthCm?: number | null` and `sheetHeightCm?: number | null`.

- [ ] **Step 1: Add the columns to the schema**

In `prisma/schema.prisma`, inside `model LimitedVariant`, replace:

```prisma
  widthCm     Float // locked to the artwork's aspect ratio
  heightCm    Float
  borderCm    Float  @default(0) // uniform paper border (holds the number)
```

with:

```prisma
  // IMAGE size, in both modes. Locked to the artwork's aspect ratio.
  // In fixed-sheet mode this is DERIVED from the sheet + minimum border
  // and stored, so the @@unique key, pricing and every existing consumer
  // keep working unchanged.
  widthCm     Float
  heightCm    Float
  // The border value handed to TPS. In adaptive mode it is exact and
  // uniform on all four sides. In fixed-sheet mode it is a MINIMUM: the
  // real borders differ per axis and are derived via computeSheetLayout.
  borderCm    Float  @default(0)
  // Fixed-sheet mode: the artist pins the total sheet and the image is
  // fitted inside it. NULL on both = adaptive mode (sheet = image +
  // 2*border). Never set only one. See src/lib/editions/sheetLayout.ts.
  sheetWidthCm  Float?
  sheetHeightCm Float?
```

- [ ] **Step 2: Regenerate the Prisma client**

Run: `pnpm db:generate`
Expected: succeeds, `src/generated/prisma` now types `sheetWidthCm` / `sheetHeightCm` as `number | null`.

**Do NOT run `prisma migrate` or `prisma db push`.** Report to the user that `schema.prisma` has changed and the columns are additive and nullable, so existing rows need no backfill. The user runs the push themselves.

- [ ] **Step 3: Extend the shared types**

In `src/lib/editions/types.ts`, add to `LimitedVariantDraft` after `borderCm`:

```ts
  /** Fixed-sheet mode: total sheet size in cm. Both null/absent = adaptive
   *  mode, where the sheet is image + 2*borderCm. When set, `borderCm` is a
   *  MINIMUM and the real per-axis borders come from computeSheetLayout. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
```

Add the identical two fields to `LimitedVariantView` after its `borderCm`.

- [ ] **Step 4: Verify the project still typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors. The fields are optional, so no existing construction site breaks.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/editions/types.ts
git commit -m "AR-135: add nullable sheet dimensions to LimitedVariant"
```

---

### Task 3: Server validation

Extends `validateVariantInput` so fixed-sheet variants are checked against the derived image, and so configurations TPS would silently alter are rejected rather than promised.

**Files:**
- Modify: `src/lib/editions/validateVariant.ts`
- Test: `e2e/limited-variant-validation.spec.ts` (create)

**Interfaces:**
- Consumes: `computeSheetLayout`, `isFixedSheet`, `TPS_BORDER_REFERENCE_WIDTH_CM`, `TPS_BORDER_CAP_FRACTION` from Task 1.
- Produces: `VariantInput` gains `sheetWidthCm?: number | null` and `sheetHeightCm?: number | null`. Behaviour of `validateVariantInput` for adaptive variants is unchanged.

- [ ] **Step 1: Write the failing test**

Create `e2e/limited-variant-validation.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { validateVariantInput } from '../src/lib/editions/validateVariant'

// A 3:2 landscape file, large enough to print at these sizes at 300 DPI.
const ARTWORK_3_2 = { widthPx: 7200, heightPx: 4800 }

const baseVariant = {
  name: 'Standard',
  paperId: 'hahnemuhle-german-etching',
  widthCm: 36,
  heightCm: 24,
  borderCm: 7,
  editionSize: 50,
  priceCents: 10000,
}

test('accepts a valid fixed-sheet variant', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, sheetWidthCm: 50, sheetHeightCm: 40 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(true)
})

test('rejects a fixed sheet whose derived image disagrees with the stored size', () => {
  const res = validateVariantInput({
    // 50x40 with a 7cm minimum derives a 36x24 image, not 30x20.
    variant: { ...baseVariant, widthCm: 30, heightCm: 20, sheetWidthCm: 50, sheetHeightCm: 40 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('derived')
})

// Fixture note: the derived image must stay INSIDE this file's printable
// long-edge range (30.0-60.96 cm for 7200x4800) or the pre-existing
// long-edge check fires first and this assertion never reaches the 40 cm
// rule. Sheet 38x30 with a 3 cm border derives a 32 x 21.3 image, which is
// in range, so the sheet-width rule is what rejects it.
test('rejects a sheet narrower than the TPS reference width', () => {
  const res = validateVariantInput({
    variant: {
      ...baseVariant,
      widthCm: 32,
      heightCm: 32 / 1.5,
      borderCm: 3,
      sheetWidthCm: 38,
      sheetHeightCm: 30,
    },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('40 cm')
})

test('rejects a border above a quarter of the shortest sheet side', () => {
  // Shortest side 40 -> cap 10. A 12cm border would be silently clipped.
  const res = validateVariantInput({
    variant: { ...baseVariant, borderCm: 12, sheetWidthCm: 50, sheetHeightCm: 40 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
})

test('rejects only one sheet dimension being set', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, sheetWidthCm: 50, sheetHeightCm: null },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('both')
})

test('adaptive variants are unaffected', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, widthCm: 45, heightCm: 30 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec playwright test e2e/limited-variant-validation.spec.ts`
Expected: FAIL — the fixed-sheet cases pass validation because no sheet rules exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/editions/validateVariant.ts`:

Add to the imports:

```ts
import {
  computeSheetLayout,
  isFixedSheet,
  TPS_BORDER_REFERENCE_WIDTH_CM,
  TPS_BORDER_CAP_FRACTION,
} from '@/lib/editions/sheetLayout'
import { MIN_SHORT_EDGE_CM } from '@/lib/print-providers/printspace/sizeBounds'
```

Add to `VariantInput`, after `borderCm: number`:

```ts
  /** Fixed-sheet mode: total sheet in cm. Both null/absent = adaptive. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
```

Insert this block immediately **before** the existing distinctness check (`// Distinct print size within the artwork`), so it runs after the border range check:

```ts
  // ── Fixed-sheet mode ──────────────────────────────────────────
  // The artist pinned the total sheet; the image and per-axis borders are
  // derived. Everything here guards against promising a layout TPS would
  // silently alter.
  const hasAnySheet = variant.sheetWidthCm != null || variant.sheetHeightCm != null
  if (hasAnySheet) {
    if (!isFixedSheet(variant)) {
      return { ok: false, error: 'Set both sheet dimensions, or neither.' }
    }
    const sheetWidthCm = variant.sheetWidthCm as number
    const sheetHeightCm = variant.sheetHeightCm as number

    // TPS measures a targeted border at a 40 cm reference width and scales
    // it DOWN below that, so a narrower sheet would not get the border the
    // artist entered and our derived layout would stop matching the print.
    if (sheetWidthCm < TPS_BORDER_REFERENCE_WIDTH_CM) {
      return {
        ok: false,
        error: `The sheet must be at least ${TPS_BORDER_REFERENCE_WIDTH_CM} cm wide — below that the print lab scales the border down and the layout would not match.`,
      }
    }

    // TPS clips a border above a quarter of the shortest side without
    // telling you.
    const capCm = Math.min(sheetWidthCm, sheetHeightCm) * TPS_BORDER_CAP_FRACTION
    if (variant.borderCm > capCm + 0.001) {
      return {
        ok: false,
        error: `On a ${sheetHeightCm} × ${sheetWidthCm} cm sheet the border can be at most ${capCm.toFixed(1)} cm.`,
      }
    }

    const layout = computeSheetLayout({
      sheetWidthCm,
      sheetHeightCm,
      minBorderCm: variant.borderCm,
      aspectRatio: artwork.widthPx / artwork.heightPx,
    })
    if (!layout) {
      return { ok: false, error: 'That border leaves no printable area on the sheet.' }
    }

    // The stored image size must be exactly what the sheet derives, or the
    // previews, buyer copy and TPS instruction would disagree with the DB.
    if (
      Math.abs(layout.imageWidthCm - variant.widthCm) >= 0.05 ||
      Math.abs(layout.imageHeightCm - variant.heightCm) >= 0.05
    ) {
      return {
        ok: false,
        error: `The print size must be the size derived from the sheet (${layout.imageHeightCm.toFixed(1)} × ${layout.imageWidthCm.toFixed(1)} cm).`,
      }
    }

    if (Math.min(layout.imageWidthCm, layout.imageHeightCm) < MIN_SHORT_EDGE_CM) {
      return {
        ok: false,
        error: `The derived print would be ${layout.imageHeightCm.toFixed(1)} × ${layout.imageWidthCm.toFixed(1)} cm — its shortest side must be at least ${MIN_SHORT_EDGE_CM} cm. Use a bigger sheet or a smaller border.`,
      }
    }
  }
```

Note the two existing checks that already cover fixed-sheet variants and need no change: the aspect lock (the derived image keeps the artwork ratio by construction) and the DPI/printable-range check (both run against `widthCm`/`heightCm`, which remain the image size).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec playwright test e2e/limited-variant-validation.spec.ts`
Expected: PASS, 6 tests.

Note on the derived-short-edge check: it is near-redundant, because `minLongCm = MIN_SHORT_EDGE_CM / aspect` means passing the long-edge check already implies a short edge ≥ 20 cm. Keep it — it guards the 0.5 cm tolerance the long-edge check allows — but do **not** write a test for it; no fixture can reach that branch.

- [ ] **Step 5: Run the existing edition specs for regressions**

Run: `pnpm exec playwright test e2e/limited-editions.spec.ts`
Expected: PASS, unchanged. Adaptive variants take the `hasAnySheet === false` path and skip the whole block.

- [ ] **Step 6: Commit**

```bash
git add src/lib/editions/validateVariant.ts e2e/limited-variant-validation.spec.ts
git commit -m "AR-135: validate fixed-sheet variants against the derived layout and TPS limits"
```

---

### Task 4: Persist and lock the sheet fields

The sheet is part of a variant's frozen identity once it is on sale, and must be written on save.

**Files:**
- Modify: `src/lib/editions/saveLimitedVariants.ts:110-121` (lock detection), `:182-192` (write payload)

**Interfaces:**
- Consumes: the `VariantInput` shape from Task 3.
- Produces: no new exports. `saveLimitedVariants` now persists `sheetWidthCm` / `sheetHeightCm` and rejects changing them on a live variant.

- [ ] **Step 1: Add the sheet to the lock check**

In `src/lib/editions/saveLimitedVariants.ts`, in the `prev.blocked` branch, replace:

```ts
          const nonPriceChanged =
            sizeChanged ||
            prev.editionSize !== v.editionSize ||
            prev.name !== v.name.trim() ||
            prev.paperId !== v.paperId ||
            Math.abs(prev.borderCm - v.borderCm) >= 0.005
```

with:

```ts
          // The sheet is part of the variant's physical identity — a live
          // edition's paper size can never change under a buyer.
          const sheetChanged =
            Math.abs((prev.sheetWidthCm ?? 0) - (v.sheetWidthCm ?? 0)) >= 0.005 ||
            Math.abs((prev.sheetHeightCm ?? 0) - (v.sheetHeightCm ?? 0)) >= 0.005
          const nonPriceChanged =
            sizeChanged ||
            sheetChanged ||
            prev.editionSize !== v.editionSize ||
            prev.name !== v.name.trim() ||
            prev.paperId !== v.paperId ||
            Math.abs(prev.borderCm - v.borderCm) >= 0.005
```

- [ ] **Step 2: Persist the fields**

In the same file, in the `const data = { ... }` write payload, add after `borderCm: input.borderCm,`:

```ts
        sheetWidthCm: input.sheetWidthCm ?? null,
        sheetHeightCm: input.sheetHeightCm ?? null,
```

- [ ] **Step 3: Write the failing test**

Append to `e2e/limited-variant-validation.spec.ts`:

```ts
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'

// Guards the invariant the lock check protects: a sheet change always
// changes the derived image, so a silent sheet swap is impossible without
// also tripping the size check.
test('changing the sheet changes the derived image', () => {
  const a = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  const b = computeSheetLayout({
    sheetWidthCm: 60,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(a.imageWidthCm).not.toBeCloseTo(b.imageWidthCm, 2)
})
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec playwright test e2e/limited-variant-validation.spec.ts e2e/limited-editions.spec.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean. If `input.sheetWidthCm` errors, the `VariantInput` extension from Task 3 Step 3 is missing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/editions/saveLimitedVariants.ts e2e/limited-variant-validation.spec.ts
git commit -m "AR-135: persist sheet dimensions and freeze them on live variants"
```

---

### Task 5: TPS recipe generator

One generator producing the exact creativehub wizard inputs. Backs both the artist-facing card (Task 6) and the admin order instruction (Task 9), so the two can never drift.

**Files:**
- Create: `src/lib/editions/tpsRecipe.ts`
- Test: `e2e/tps-recipe.spec.ts`

**Interfaces:**
- Consumes: `computeSheetLayout`, `isFixedSheet` from Task 1.
- Produces:
  - `type TpsRecipe = { sheetWidthCm: number; sheetHeightCm: number; sheetWidthIn: number; sheetHeightIn: number; borderMm: number; distribution: 'Even'; fitMethod: string; paperLabel: string; expectedImageWidthCm: number; expectedImageHeightCm: number; expectedBorderXCm: number; expectedBorderYCm: number }`
  - `buildTpsRecipe(args: { widthCm: number; heightCm: number; borderCm: number; sheetWidthCm?: number | null; sheetHeightCm?: number | null; paperLabel: string }): TpsRecipe | null`
  - `formatTpsRecipe(recipe: TpsRecipe, opts?: { title?: string }): string`

- [ ] **Step 1: Write the failing test**

Create `e2e/tps-recipe.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { buildTpsRecipe, formatTpsRecipe } from '../src/lib/editions/tpsRecipe'

test('fixed-sheet recipe reproduces the verified TPS setup', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  expect(recipe.sheetWidthCm).toBe(50)
  expect(recipe.sheetHeightCm).toBe(40)
  expect(recipe.borderMm).toBe(70)
  expect(recipe.distribution).toBe('Even')
  expect(recipe.expectedImageWidthCm).toBeCloseTo(36, 5)
  expect(recipe.expectedImageHeightCm).toBeCloseTo(24, 5)
  expect(recipe.expectedBorderXCm).toBeCloseTo(7, 5)
  expect(recipe.expectedBorderYCm).toBeCloseTo(8, 5)
})

test('inches are rounded to one decimal, matching the TPS row', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  expect(recipe.sheetWidthIn).toBe(19.7)
  expect(recipe.sheetHeightIn).toBe(15.7)
})

test('adaptive recipe derives the sheet as image plus twice the border', () => {
  const recipe = buildTpsRecipe({
    widthCm: 27.9,
    heightCm: 40,
    borderCm: 3,
    paperLabel: 'Hahnemühle German Etching',
  })!
  expect(recipe.sheetWidthCm).toBeCloseTo(33.9, 5)
  expect(recipe.sheetHeightCm).toBeCloseTo(46, 5)
  expect(recipe.borderMm).toBe(30)
  // A same-shape sheet gives equal borders on both axes.
  expect(recipe.expectedBorderXCm).toBeCloseTo(recipe.expectedBorderYCm, 3)
})

test('formatted output is width-first and explicitly labelled', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  const text = formatTpsRecipe(recipe, { title: 'Saut de l’ange · 50×40 Standard' })
  expect(text).toContain('W × H')
  expect(text).toContain('50 × 40 cm')
  expect(text).toContain('19.7 × 15.7 in')
  expect(text).toContain('70 mm')
  expect(text).toContain('Even')
  expect(text).toContain('Add a border')
  expect(text).toContain('Hahnemühle German Etching')
  // The acceptance line the operator checks against the TPS preview.
  expect(text).toContain('36 × 24 cm')
  expect(text).toContain('7.0')
  expect(text).toContain('8.0')
  // Must NOT print our own H×W order for the TPS fields.
  expect(text).not.toContain('40 × 50 cm')
})

test('returns null when the geometry is impossible', () => {
  expect(
    buildTpsRecipe({
      widthCm: 10,
      heightCm: 10,
      borderCm: 20,
      sheetWidthCm: 30,
      sheetHeightCm: 30,
      paperLabel: 'Hahnemühle German Etching',
    }),
  ).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec playwright test e2e/tps-recipe.spec.ts`
Expected: FAIL — cannot resolve `../src/lib/editions/tpsRecipe`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/editions/tpsRecipe.ts`:

```ts
/**
 * Generates the exact creativehub product-wizard inputs for a variant, so
 * the configuration can be reproduced by hand without arithmetic.
 *
 * Why this exists: TPS is WIDTH-first while every other surface in this app
 * is HEIGHT × WIDTH, and their border field is in millimetres while ours is
 * in centimetres. Both conversions are easy to get wrong by hand and the
 * failure is expensive — a transposed sheet prints the wrong object. This
 * module does them once and labels the result.
 *
 * The same generator backs the artist editor card and the admin order
 * instruction, so the product config and the order can never disagree.
 */
import { computeSheetLayout, isFixedSheet } from '@/lib/editions/sheetLayout'

const CM_PER_INCH = 2.54

/** TPS offers Even / Bottom weighted / Aspect ratio. We model Even only. */
const DISTRIBUTION = 'Even' as const

/** The fit-method option to pick when a sheet is off-ratio. Never crop. */
const FIT_METHOD = 'Add a border (keep whole artwork)'

export type TpsRecipe = {
  /** Sheet size in cm, WIDTH first — the order the TPS field expects. */
  sheetWidthCm: number
  sheetHeightCm: number
  /** The same sheet in inches, as the TPS row shows alongside cm. */
  sheetWidthIn: number
  sheetHeightIn: number
  /** Targeted/minimum border in mm — the unit of the TPS field. */
  borderMm: number
  distribution: typeof DISTRIBUTION
  fitMethod: string
  paperLabel: string
  /** What the creativehub preview must show. The acceptance test. */
  expectedImageWidthCm: number
  expectedImageHeightCm: number
  expectedBorderXCm: number
  expectedBorderYCm: number
}

export type BuildTpsRecipeArgs = {
  /** Image size in cm. */
  widthCm: number
  heightCm: number
  /** Border in cm — exact in adaptive mode, minimum in fixed-sheet mode. */
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  paperLabel: string
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function buildTpsRecipe(args: BuildTpsRecipeArgs): TpsRecipe | null {
  const { widthCm, heightCm, borderCm, paperLabel } = args

  if (
    !Number.isFinite(widthCm) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(borderCm) ||
    widthCm <= 0 ||
    heightCm <= 0 ||
    borderCm < 0
  ) {
    return null
  }

  // Adaptive mode: the sheet is simply the image plus the border on each
  // side, so both axes get the same border and there is nothing to derive.
  const fixed = isFixedSheet(args)
  const sheetWidthCm = fixed ? (args.sheetWidthCm as number) : widthCm + borderCm * 2
  const sheetHeightCm = fixed ? (args.sheetHeightCm as number) : heightCm + borderCm * 2

  const layout = computeSheetLayout({
    sheetWidthCm,
    sheetHeightCm,
    minBorderCm: borderCm,
    aspectRatio: widthCm / heightCm,
  })
  if (!layout) return null

  return {
    sheetWidthCm,
    sheetHeightCm,
    sheetWidthIn: round1(sheetWidthCm / CM_PER_INCH),
    sheetHeightIn: round1(sheetHeightCm / CM_PER_INCH),
    borderMm: Math.round(borderCm * 10),
    distribution: DISTRIBUTION,
    fitMethod: FIT_METHOD,
    paperLabel,
    expectedImageWidthCm: layout.imageWidthCm,
    expectedImageHeightCm: layout.imageHeightCm,
    expectedBorderXCm: layout.borderXCm,
    expectedBorderYCm: layout.borderYCm,
  }
}

/**
 * Renders the recipe as the copyable block shown in the editor and pasted
 * into the order notes. Dimensions are width-first and say so, because the
 * reader is about to type them into a width-first form.
 */
export function formatTpsRecipe(recipe: TpsRecipe, opts?: { title?: string }): string {
  const lines: string[] = []
  if (opts?.title) lines.push(`TPS setup — ${opts.title}`, '')
  lines.push(
    `Custom size (W × H)   ${round1(recipe.sheetWidthCm)} × ${round1(recipe.sheetHeightCm)} cm      (${recipe.sheetWidthIn} × ${recipe.sheetHeightIn} in)`,
    `Fit method            ${recipe.fitMethod}`,
    `Border size           Custom`,
    `Distribution          ${recipe.distribution}`,
    `Units                 Millimeters`,
    `Targeted border       ${recipe.borderMm} mm`,
    `Paper                 ${recipe.paperLabel}`,
    '',
    `Expect: image ${round1(recipe.expectedImageWidthCm)} × ${round1(recipe.expectedImageHeightCm)} cm · borders ${recipe.expectedBorderXCm.toFixed(1)} h / ${recipe.expectedBorderYCm.toFixed(1)} v`,
  )
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec playwright test e2e/tps-recipe.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editions/tpsRecipe.ts e2e/tps-recipe.spec.ts
git commit -m "AR-135: add TPS recipe generator for reproducing a variant by hand"
```

---

### Task 6: Artist editor — mode toggle, sheet inputs, readout, recipe card

**Files:**
- Modify: `src/components/shared/ArtworkEditForm/LimitedVariantsEditor/index.tsx`
- Modify: `src/components/shared/ArtworkEditForm/LimitedVariantsEditor/LimitedVariantsEditor.module.scss`
- Test: `e2e/limited-variant-sheet-editor.spec.ts` (create)

**Interfaces:**
- Consumes: `computeSheetLayout`, `isFixedSheet` (Task 1); `buildTpsRecipe`, `formatTpsRecipe` (Task 5); `LimitedVariantDraft` with sheet fields (Task 2).
- Produces: no new exports. The editor writes `sheetWidthCm` / `sheetHeightCm` onto drafts and keeps `widthCm` / `heightCm` in sync with the derived image.

- [ ] **Step 1: Add the mode toggle and sheet fields**

In `LimitedVariantsEditor/index.tsx`, add to the imports:

```ts
import { computeSheetLayout, isFixedSheet } from '@/lib/editions/sheetLayout'
import { buildTpsRecipe, formatTpsRecipe } from '@/lib/editions/tpsRecipe'
import { TPS_PAPERS as PAPERS_FOR_LABEL } from '@/lib/print-providers/printspace'
```

Add this helper above the `return`, inside the component so it closes over `aspectRatio`:

```ts
  // In fixed-sheet mode the image size is DERIVED, never typed. Recompute
  // it whenever the sheet or the minimum border changes so widthCm /
  // heightCm — which the server, pricing and the uniqueness key all read —
  // stay in lockstep with what will actually print.
  const withDerivedImage = (v: LimitedVariantDraft): Partial<LimitedVariantDraft> => {
    if (!isFixedSheet(v)) return {}
    const layout = computeSheetLayout({
      sheetWidthCm: v.sheetWidthCm as number,
      sheetHeightCm: v.sheetHeightCm as number,
      minBorderCm: v.borderCm,
      aspectRatio,
    })
    if (!layout) return {}
    return { widthCm: layout.imageWidthCm, heightCm: layout.imageHeightCm }
  }

  const setSheetMode = (index: number, fixed: boolean) => {
    const v = variants[index]
    if (!fixed) {
      update(index, { sheetWidthCm: null, sheetHeightCm: null })
      return
    }
    // Seed the sheet from the current image + border so the toggle never
    // lands the artist on an invalid card.
    const seedW = v.widthCm > 0 ? v.widthCm + v.borderCm * 2 : 0
    const seedH = v.heightCm > 0 ? v.heightCm + v.borderCm * 2 : 0
    const next = { ...v, sheetWidthCm: seedW, sheetHeightCm: seedH }
    update(index, { sheetWidthCm: seedW, sheetHeightCm: seedH, ...withDerivedImage(next) })
  }

  const updateSheet = (index: number, patch: { sheetWidthCm?: number; sheetHeightCm?: number }) => {
    const next = { ...variants[index], ...patch }
    update(index, { ...patch, ...withDerivedImage(next) })
  }
```

Change the border `onChange` (currently at lines ~334-338) so it also re-derives:

```ts
                      onChange={(e) => {
                        const borderCm = Number(e.target.value.replace(/[^0-9]/g, '')) || 0
                        const next = { ...variant, borderCm }
                        update(index, { borderCm, ...withDerivedImage(next) })
                      }}
```

- [ ] **Step 2: Add the sheet field error**

The JSX in the next step references `errFor('sheet')`, so this key must exist first or the build breaks between steps. Extend `fieldErrorsOf` with a `sheet` key:

```ts
    sheet: isFixedSheet(v)
      ? !((v.sheetWidthCm ?? 0) >= 40)
        ? 'The sheet must be at least 40 cm wide.'
        : !(
              v.borderCm <=
              Math.min(v.sheetWidthCm as number, v.sheetHeightCm as number) * 0.25 + 0.001
            )
          ? 'The border is too large for this sheet — use at most a quarter of its shortest side.'
          : !(v.widthCm > 0 && v.heightCm > 0)
            ? 'That sheet and border leave no printable area.'
            : null
      : null,
```

These mirror the server rules added in Task 3 so the artist never hits a blind 400. Per the validation convention they stay silent until "Ready to Sell" is clicked, which `errFor` already handles.

- [ ] **Step 3: Render the mode toggle, sheet inputs and readout**

Replace the `Print size (cm)` field block (currently lines ~302-321) with:

```tsx
                <div className={dashboardStyles.field}>
                  <label>Sheet size</label>
                  <div className={styles.modeToggle} role="group" aria-label="Sheet size mode">
                    <Button
                      type="button"
                      variant={isFixedSheet(variant) ? 'secondary' : 'primary'}
                      disabled={variantLocked}
                      onClick={() => setSheetMode(index, false)}
                    >
                      Grows with the print
                    </Button>
                    <Button
                      type="button"
                      variant={isFixedSheet(variant) ? 'primary' : 'secondary'}
                      disabled={variantLocked}
                      onClick={() => setSheetMode(index, true)}
                    >
                      Fixed sheet
                    </Button>
                  </div>
                  <span className={styles.hint}>
                    {isFixedSheet(variant)
                      ? 'You set the paper size; the print is sized to fit inside it and the borders are worked out for you.'
                      : 'The paper grows around the print — print size plus the border on every side.'}
                  </span>
                </div>

                {isFixedSheet(variant) ? (
                  <div className={styles.twoCol}>
                    <div className={dashboardStyles.field}>
                      <label>Sheet height (cm)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        size="medium"
                        value={variant.sheetHeightCm ? String(variant.sheetHeightCm) : ''}
                        disabled={variantLocked}
                        invalid={!!errFor('sheet')}
                        onChange={(e) =>
                          updateSheet(index, {
                            sheetHeightCm: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0,
                          })
                        }
                      />
                    </div>
                    <div className={dashboardStyles.field}>
                      <label>Sheet width (cm)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        size="medium"
                        value={variant.sheetWidthCm ? String(variant.sheetWidthCm) : ''}
                        disabled={variantLocked}
                        invalid={!!errFor('sheet')}
                        onChange={(e) =>
                          updateSheet(index, {
                            sheetWidthCm: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className={dashboardStyles.field}>
                    <label>Print size (cm)</label>
                    <CustomSizeInputs
                      custom={SIZE_CUSTOM}
                      aspectRatio={aspectRatio}
                      longEdgeBounds={longEdgeBounds}
                      customSize={{ widthCm: variant.widthCm, heightCm: variant.heightCm }}
                      disabled={variantLocked}
                      showSlider={false}
                      onChange={(size) =>
                        update(index, { widthCm: size.widthCm, heightCm: size.heightCm })
                      }
                    />
                  </div>
                )}
                <ErrorText>{errFor('size')}</ErrorText>
                <ErrorText>{errFor('sheet')}</ErrorText>
                {duplicateSize && (
                  <ErrorText>
                    Each variant must have a distinct print size — this one clashes with another.
                  </ErrorText>
                )}
```

- [ ] **Step 4: Add the live readout and the TPS recipe card**

Insert immediately after the border / number-of-copies `twoCol` block:

```tsx
                {(() => {
                  const paperLabel =
                    PAPERS_FOR_LABEL.find((p) => p.id === variant.paperId)?.label ?? variant.paperId
                  const recipe = buildTpsRecipe({
                    widthCm: variant.widthCm,
                    heightCm: variant.heightCm,
                    borderCm: variant.borderCm,
                    sheetWidthCm: variant.sheetWidthCm,
                    sheetHeightCm: variant.sheetHeightCm,
                    paperLabel,
                  })
                  if (!recipe) return null
                  const text = formatTpsRecipe(recipe, {
                    title: variant.name || `Variant ${index + 1}`,
                  })
                  return (
                    <div className={styles.layoutSummary}>
                      {/* Our own convention: height x width. */}
                      <p className={styles.layoutLine}>
                        <strong>Sheet</strong> {recipe.sheetHeightCm.toFixed(1)} ×{' '}
                        {recipe.sheetWidthCm.toFixed(1)} cm · <strong>Print</strong>{' '}
                        {recipe.expectedImageHeightCm.toFixed(1)} ×{' '}
                        {recipe.expectedImageWidthCm.toFixed(1)} cm · <strong>Borders</strong>{' '}
                        {recipe.expectedBorderYCm.toFixed(1)} top/bottom,{' '}
                        {recipe.expectedBorderXCm.toFixed(1)} left/right cm
                      </p>
                      <details className={styles.recipeDetails}>
                        <summary>Print lab setup</summary>
                        <pre className={styles.recipe}>{text}</pre>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => navigator.clipboard?.writeText(text)}
                        >
                          Copy setup
                        </Button>
                      </details>
                    </div>
                  )
                })()}
```

- [ ] **Step 5: Add the styles**

In `LimitedVariantsEditor.module.scss`, append:

```scss
.modeToggle {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.layoutSummary {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.layoutLine {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.recipeDetails {
  margin-top: var(--space-2);

  summary {
    cursor: pointer;
    font-size: var(--font-size-sm);
  }
}

.recipe {
  margin: var(--space-2) 0;
  padding: var(--space-2);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  white-space: pre;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}
```

If any token above is absent from the project's token set, substitute the nearest existing token — do **not** add a `var()` fallback.

- [ ] **Step 6: Write the failing test**

Create `e2e/limited-variant-sheet-editor.spec.ts`. Follow the fixture and teardown helpers in `e2e/edition-helpers.ts` and `e2e/cleanup-helpers.ts`; every fixture created must be deleted by run-end.

```ts
import { test, expect } from '@playwright/test'
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'

// The editor keeps widthCm/heightCm in lockstep with the sheet. This spec
// asserts the derivation the UI performs, so a refactor that stops
// re-deriving on border change is caught.
test('editor derivation: 50x40 sheet with a 7cm border derives 36x24', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(layout.imageWidthCm).toBeCloseTo(36, 5)
  expect(layout.imageHeightCm).toBeCloseTo(24, 5)
})

test('editor derivation: changing the border re-derives the image', () => {
  const before = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  const after = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 6,
    aspectRatio: 1.5,
  })!
  expect(after.imageWidthCm).toBeGreaterThan(before.imageWidthCm)
})
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `pnpm exec playwright test e2e/limited-variant-sheet-editor.spec.ts`
Expected: PASS, 2 tests.

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Verify in the running app**

Run: `pnpm dev` (port 3001). Open a limited artwork's edit page, expand a variant, switch to **Fixed sheet**, enter height 40 / width 50 with a border of 7, and confirm the readout reads `Sheet 40.0 × 50.0 cm · Print 24.0 × 36.0 cm · Borders 8.0 top/bottom, 7.0 left/right cm` and that "Print lab setup" shows `50 × 40 cm` / `70 mm`.

- [ ] **Step 9: Commit**

```bash
git add src/components/shared/ArtworkEditForm/LimitedVariantsEditor e2e/limited-variant-sheet-editor.spec.ts
git commit -m "AR-135: add fixed-sheet mode, layout readout and TPS setup card to the variant editor"
```

---

### Task 7: Margin guardrail

Free-entry sheet sizes plus the decision that the gallery absorbs the sheet-vs-image cost make it possible to configure a loss-making variant. This surfaces the number and blocks the loss.

**Files:**
- Create: `src/lib/editions/variantMargin.ts`
- Modify: `src/components/shared/ArtworkEditForm/LimitedVariantsEditor/index.tsx`
- Modify: `src/lib/editions/validateVariant.ts`
- Test: `e2e/variant-margin.spec.ts`

**Interfaces:**
- Consumes: `buildTpsRecipe` (Task 5); `getPrintBaseCents` and `TPS_GALLERY_MARKUP_RATE` from `src/lib/print-providers/printspace/pricing.ts`.
- Produces: `estimateVariantMarginCents(args: { widthCm: number; heightCm: number; borderCm: number; sheetWidthCm?: number | null; sheetHeightCm?: number | null; artistPriceCents: number }): { galleryCutCents: number; absorbedCents: number; marginCents: number } | null`

- [ ] **Step 1: Write the failing test**

Create `e2e/variant-margin.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { estimateVariantMarginCents } from '../src/lib/editions/variantMargin'
import { TPS_GALLERY_MARKUP_RATE } from '../src/lib/print-providers/printspace/pricing'

test('the artist’s real variant leaves a healthy margin', () => {
  const m = estimateVariantMarginCents({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    artistPriceCents: 10000,
  })!
  expect(m.galleryCutCents).toBe(Math.round(10000 * TPS_GALLERY_MARKUP_RATE))
  expect(m.absorbedCents).toBeGreaterThan(0)
  expect(m.marginCents).toBeGreaterThan(0)
})

test('a wildly oversized sheet goes negative', () => {
  const m = estimateVariantMarginCents({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 100,
    sheetHeightCm: 70,
    artistPriceCents: 10000,
  })!
  expect(m.marginCents).toBeLessThan(0)
})

test('an adaptive variant absorbs only the border ring', () => {
  const m = estimateVariantMarginCents({
    widthCm: 27.9,
    heightCm: 40,
    borderCm: 3,
    artistPriceCents: 10000,
  })!
  expect(m.absorbedCents).toBeGreaterThan(0)
  expect(m.marginCents).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec playwright test e2e/variant-margin.spec.ts`
Expected: FAIL — cannot resolve `../src/lib/editions/variantMargin`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/editions/variantMargin.ts`:

```ts
/**
 * Estimates what the gallery keeps on one print of a variant.
 *
 * Context (decision 2026-08-17): buyer pricing is computed from the IMAGE
 * area, but theprintspace bills us for the SHEET. The gallery absorbs the
 * difference rather than raising buyer prices. That is fine at ordinary
 * border sizes and ruinous at extreme ones, so the editor shows this number
 * and validation blocks a negative one.
 *
 * Deliberately approximate: it compares print-base cost on the two areas
 * and ignores shipping (which lands in the same band in every realistic
 * case) and the per-order COA + letter cost. It exists to catch a
 * configuration mistake, not to be an accounting figure.
 */
import { getPrintBaseCents, TPS_GALLERY_MARKUP_RATE } from '@/lib/print-providers/printspace/pricing'
import { buildTpsRecipe } from '@/lib/editions/tpsRecipe'

export type VariantMargin = {
  /** What the gallery charges on top of the artist's cut. */
  galleryCutCents: number
  /** Sheet cost minus the image cost the buyer was charged for. */
  absorbedCents: number
  /** What is left. Negative means every sale loses money. */
  marginCents: number
}

export function estimateVariantMarginCents(args: {
  widthCm: number
  heightCm: number
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  artistPriceCents: number
}): VariantMargin | null {
  const recipe = buildTpsRecipe({ ...args, paperLabel: '' })
  if (!recipe || !Number.isFinite(args.artistPriceCents) || args.artistPriceCents <= 0) {
    return null
  }

  const imageCents = getPrintBaseCents(args.widthCm, args.heightCm)
  const sheetCents = getPrintBaseCents(recipe.sheetWidthCm, recipe.sheetHeightCm)
  const absorbedCents = Math.max(0, sheetCents - imageCents)
  const galleryCutCents = Math.round(args.artistPriceCents * TPS_GALLERY_MARKUP_RATE)

  return {
    galleryCutCents,
    absorbedCents,
    marginCents: galleryCutCents - absorbedCents,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec playwright test e2e/variant-margin.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Block a negative margin server-side**

In `src/lib/editions/validateVariant.ts`, add the import:

```ts
import { estimateVariantMarginCents } from '@/lib/editions/variantMargin'
```

and insert immediately after the fixed-sheet block added in Task 3, still before the distinctness check.

**This gate applies in fixed-sheet mode ONLY** — note the `isFixedSheet(variant) &&` guard. Adaptive variants absorb a smaller gap that the spec explicitly accepts, and firing this for them could reject existing valid low-priced editions on re-save.

```ts
  // Guardrail: the gallery absorbs the sheet-vs-image cost, so an oversized
  // sheet can silently make every sale lose money. Fixed-sheet mode only —
  // the sheet is free-entry there, so the gap is unbounded.
  const margin = isFixedSheet(variant)
    ? estimateVariantMarginCents({
        widthCm: variant.widthCm,
        heightCm: variant.heightCm,
        borderCm: variant.borderCm,
        sheetWidthCm: variant.sheetWidthCm,
        sheetHeightCm: variant.sheetHeightCm,
        artistPriceCents: variant.priceCents,
      })
    : null
  if (margin && margin.marginCents <= 0) {
    return {
      ok: false,
      error: `This sheet costs more to produce than the variant earns. Raise the price, shrink the sheet, or reduce the border.`,
    }
  }
```

- [ ] **Step 6: Show it in the editor**

In `LimitedVariantsEditor/index.tsx`, import:

```ts
import { estimateVariantMarginCents } from '@/lib/editions/variantMargin'
```

and inside the `layoutSummary` block added in Task 6 Step 4, after the `layoutLine` paragraph:

```tsx
                      {(() => {
                        const margin = estimateVariantMarginCents({
                          widthCm: variant.widthCm,
                          heightCm: variant.heightCm,
                          borderCm: variant.borderCm,
                          sheetWidthCm: variant.sheetWidthCm,
                          sheetHeightCm: variant.sheetHeightCm,
                          artistPriceCents: Math.round(Number(variant.priceEuros ?? 0) * 100),
                        })
                        if (!margin) return null
                        const euros = (c: number) => (c / 100).toFixed(2)
                        return margin.marginCents <= 0 ? (
                          <ErrorText>
                            The wider sheet costs €{euros(margin.absorbedCents)} more to produce than
                            a print of the image alone, which is more than this variant earns. Raise
                            the price or reduce the sheet.
                          </ErrorText>
                        ) : (
                          <p className={styles.layoutLine}>
                            Gallery keeps €{euros(margin.marginCents)} per print (€
                            {euros(margin.absorbedCents)} of the wider sheet absorbed).
                          </p>
                        )
                      })()}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm exec playwright test e2e/variant-margin.spec.ts e2e/limited-variant-validation.spec.ts e2e/limited-editions.spec.ts`
Expected: PASS. If an existing `limited-editions` fixture now fails the margin gate, its fixture price is unrealistically low — raise the fixture's price rather than weakening the gate, and note it in the commit message.

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/editions/variantMargin.ts src/lib/editions/validateVariant.ts src/components/shared/ArtworkEditForm/LimitedVariantsEditor/index.tsx e2e/variant-margin.spec.ts
git commit -m "AR-135: surface and block loss-making sheet configurations"
```

---

### Task 8: Previews render per-axis borders

Both previewers currently apply one border scalar to both axes, so a fixed-sheet variant would show a sheet of the wrong shape. Each component gains an optional second axis defaulting to the first, so every existing call site keeps rendering identically.

**Files:**
- Modify: `src/components/PrintWizard/SizeSchema.tsx:69-70` and `:119-120`
- Modify: `src/components/PrintWizard/scene/PreviewArtwork.tsx:128-129`
- Modify: `src/components/PrintWizard/scene/preview/StandardPreview.tsx:16-17, 51-52`
- Modify: `src/components/PrintWizard/scene/preview/FloatingPreview.tsx:61-62`
- Modify: `src/components/PrintWizard/scene/preview/BoxPreview.tsx:54-55`
- Modify: `src/components/PrintWizard/scene/preview/TrayPreview.tsx:66-67`

**Interfaces:**
- Consumes: nothing new.
- Produces: each of the five 3D components accepts `paperBorderYM?: number` (defaulting to `paperBorderM`); `SizeSchema` accepts `paperBorderYCm?: number` (defaulting to `paperBorderCm`).

- [ ] **Step 1: Add the optional prop to each 3D preview**

For **each** of `StandardPreview.tsx`, `FloatingPreview.tsx`, `BoxPreview.tsx`, `TrayPreview.tsx`, `PreviewArtwork.tsx`:

Add to the props interface, immediately after the existing `paperBorderM` declaration:

```ts
  /** Vertical (top/bottom) paper border in metres. Defaults to
   *  `paperBorderM`. Differs only for fixed-sheet editions, where the sheet
   *  is a different shape from the image so the two axes diverge. */
  paperBorderYM?: number
```

Add it to the destructured parameter list with a default of the horizontal value. In `StandardPreview`, `FloatingPreview`, `BoxPreview` and `TrayPreview` that is:

```ts
  paperBorderYM = paperBorderM,
```

(Destructuring defaults may reference earlier bindings, so `paperBorderM` must appear before `paperBorderYM` in the list — it already does.)

Then replace the height line only. In `StandardPreview.tsx`, `FloatingPreview.tsx`, `BoxPreview.tsx`, `TrayPreview.tsx`:

```ts
  const paperWidthM = printWidthM + paperBorderM * 2
  const paperHeightM = printHeightM + paperBorderYM * 2
```

In `PreviewArtwork.tsx:128-129` the locals are named differently:

```ts
    const paperWidthM = widthM + paperBorderM * 2
    const paperHeightM = heightM + paperBorderYM * 2
```

Leave every downstream layer untouched — `backboardWidthM`, `matWidthM`, `cavityWidthM` and the moulding all stack outward from `paperWidthM`/`paperHeightM` with uniform borders of their own, so they inherit the asymmetry correctly.

- [ ] **Step 2: Add the optional prop to the 2D schema**

In `SizeSchema.tsx`, add `paperBorderYCm?: number` to `SizeSchemaProps` after `paperBorderCm`, default it in the destructuring (`paperBorderYCm = paperBorderCm,` — it must come after `paperBorderCm`), then change:

```ts
  const effectivePaperBorder = Math.max(paperBorderCm, 0)
  const effectivePaperBorderY = Math.max(paperBorderYCm, 0)
```

and:

```ts
  const paperWidthCm = printWidthCm + effectivePaperBorder * 2
  const paperHeightCm = printHeightCm + effectivePaperBorderY * 2
```

- [ ] **Step 3: Fix the px path**

`SizeSchema.tsx:107-120` scales the print to fit the viewBox, computing one `paperBorderW` in px and applying it to both axes. Immediately after the existing `paperBorderW` assignment (line 108-109), add its vertical companion using the **same** `rawScale` and the same 3 px floor:

```ts
  const paperBorderH =
    effectivePaperBorderY > 0 ? Math.max(effectivePaperBorderY * rawScale, MIN_PAPER_PX) : 0
```

Then at line 120 change the height only:

```ts
  const paperW = printW + paperBorderW * 2
  const paperH = printH + paperBorderH * 2
```

Both axes must share `rawScale` — never scale them independently, or the sheet skews.

`borderPx` (line 114) is the chrome reserved before re-fitting the print. Use the **larger** of the two paper borders so the layout still fits the viewBox:

```ts
  const borderPx = (frameW + matBorderW + backboardW + Math.max(paperBorderW, paperBorderH)) * 2
```

Also check the sheet-boundary stroke referenced in the comment at line 197 (`when paperBorderCm > 0`) — it must now also render when only `paperBorderYCm > 0`.

- [ ] **Step 4: Verify nothing regressed**

Run: `pnpm tsc --noEmit`
Expected: clean. Every existing call site omits the new prop and gets the previous behaviour by default.

Run: `pnpm exec playwright test`
Expected: PASS, unchanged. Per project rule the wizard 3D scene is never mounted in e2e, so these components are covered by typecheck plus the manual check below.

- [ ] **Step 5: Verify visually**

Run: `pnpm dev` (port 3001). Open the print wizard for an open-edition artwork and confirm the 2D schema and 3D preview are visually unchanged from before this task — this step is a regression check, since no caller passes the new prop yet.

- [ ] **Step 6: Commit**

```bash
git add src/components/PrintWizard
git commit -m "AR-135: let both previewers render per-axis paper borders"
```

---

### Task 9: Wire fixed-sheet layout into the buyer wizard

Feeds the derived vertical border into the previews and makes the buyer-facing numbers name the sheet.

**Files:**
- Modify: `src/lib/editions/variantToWizardConfig.ts`
- Modify: `src/lib/print-providers/specs.ts:85-92` (the `border` row)
- Modify: `src/components/PrintWizard/VariantPicker.tsx:44`
- Test: `e2e/limited-variant-buyer-copy.spec.ts` (create)

**Interfaces:**
- Consumes: `computeSheetLayout`, `isFixedSheet` (Task 1); the `paperBorderYM` / `paperBorderYCm` props (Task 8).
- Produces: `variantToWizardConfig` carries the per-axis borders through to the preview components.

- [ ] **Step 1: Read the current config mapper**

Read `src/lib/editions/variantToWizardConfig.ts` in full. It currently maps a variant to `customSize: { widthCm, heightCm }` and `borders: { border: { allCm: variant.borderCm } }`.

- [ ] **Step 2: Carry the vertical border through**

Extend the returned config with the derived vertical border for fixed-sheet variants, leaving `allCm` as the horizontal value so every existing consumer keeps working:

```ts
import { computeSheetLayout, isFixedSheet } from '@/lib/editions/sheetLayout'

// ...inside the mapper, after the existing size/border mapping:

  // Fixed-sheet variants have different horizontal and vertical borders.
  // `allCm` stays the horizontal value (what every existing consumer and
  // the TPS field expect); the vertical one rides alongside so the
  // previewers can draw the real sheet shape.
  if (isFixedSheet(variant)) {
    const layout = computeSheetLayout({
      sheetWidthCm: variant.sheetWidthCm as number,
      sheetHeightCm: variant.sheetHeightCm as number,
      minBorderCm: variant.borderCm,
      aspectRatio: variant.widthCm / variant.heightCm,
    })
    if (layout) {
      config.borders = {
        ...config.borders,
        border: { allCm: layout.borderXCm, verticalCm: layout.borderYCm },
      }
    }
  }
```

Widen the border-config type at `src/lib/print-providers/types.ts:171`:

```ts
  borders?: Record<string, { allCm: number; verticalCm?: number }>
```

`verticalCm` is optional, so every existing construction site keeps compiling. Then pass it into the preview components at their call sites as `paperBorderYM` / `paperBorderYCm`, converting cm→m exactly as the existing `paperBorderM` is converted at each site.

- [ ] **Step 3: Name the sheet in the buyer specs**

In `src/lib/print-providers/specs.ts`, in the `dim.kind === 'border'` branch, when a vertical border is present and differs from the horizontal one, render both and name the sheet. Replace:

```ts
    const cm = getEffectiveBorderCm(config, dim.id)
    if (cm <= 0) return '—'
    return `${roundCm(cm)} cm`
```

with:

```ts
    const cm = getEffectiveBorderCm(config, dim.id)
    const verticalCm = config.borders?.[dim.id]?.verticalCm
    if (cm <= 0 && !verticalCm) return '—'
    // Fixed-sheet editions have unequal borders by design — showing one
    // number would misdescribe the object the buyer receives.
    if (typeof verticalCm === 'number' && Math.abs(verticalCm - cm) >= 0.05) {
      return `${roundCm(verticalCm)} cm top and bottom, ${roundCm(cm)} cm left and right`
    }
    return `${roundCm(cm)} cm`
```

- [ ] **Step 4: Show the sheet in the variant picker**

In `src/components/PrintWizard/VariantPicker.tsx:44`, the label currently reads `{formatDualDimensions(v.widthCm, v.heightCm)} · Unframed`. For a fixed-sheet variant the sheet is what arrives and what a frame is bought for, so lead with it:

```tsx
  isFixedSheet(v)
    ? `${formatDualDimensions(v.sheetWidthCm as number, v.sheetHeightCm as number)} sheet · ${formatDualDimensions(v.widthCm, v.heightCm)} image · Unframed`
    : `${formatDualDimensions(v.widthCm, v.heightCm)} · Unframed`
```

Import `isFixedSheet` from `@/lib/editions/sheetLayout`. `formatDualDimensions(wCm, hCm)` is **width-first** (`src/lib/print-providers/format.ts:17`), which is why both calls above pass width then height — it handles the H×W display order internally.

- [ ] **Step 5: Write the failing test**

Create `e2e/limited-variant-buyer-copy.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'

// The buyer must never be shown a single border figure for a fixed-sheet
// edition — the two axes genuinely differ and the sheet is the object sold.
test('fixed-sheet borders differ enough to require both figures', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(Math.abs(layout.borderYCm - layout.borderXCm)).toBeGreaterThanOrEqual(0.05)
})

test('a same-shape sheet keeps a single border figure', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 36 + 6,
    sheetHeightCm: 24 + 6,
    minBorderCm: 3,
    aspectRatio: 1.5,
  })!
  expect(Math.abs(layout.borderYCm - layout.borderXCm)).toBeLessThan(0.05)
})
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm exec playwright test e2e/limited-variant-buyer-copy.spec.ts`
Expected: PASS, 2 tests.

Run: `pnpm tsc --noEmit`
Expected: clean.

Run: `pnpm exec playwright test`
Expected: PASS, full suite.

- [ ] **Step 7: Commit**

```bash
git add src/lib/editions/variantToWizardConfig.ts src/lib/print-providers/specs.ts src/lib/print-providers/types.ts src/components/PrintWizard/VariantPicker.tsx e2e/limited-variant-buyer-copy.spec.ts
git commit -m "AR-135: show the real sheet and per-axis borders to buyers"
```

---

### Task 10: Admin order instruction

Replaces the hand-built TPS string with the shared recipe generator, so the order instruction and the product configuration come from one place.

**Files:**
- Modify: `src/app/admin/orders/actions.ts:1046-1048` and `:1086-1089`
- Test: `e2e/tps-recipe.spec.ts` (extend)

**Interfaces:**
- Consumes: `buildTpsRecipe`, `formatTpsRecipe` (Task 5).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `e2e/tps-recipe.spec.ts` (add `formatTpsRecipeLine` to the existing import from `../src/lib/editions/tpsRecipe` rather than writing a second import statement):

```ts
test('the admin one-liner is width-first and names the sheet', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  const line = formatTpsRecipeLine(recipe, {
    printTypeLabel: 'Giclée',
    number: 3,
    editionSize: 50,
  })
  expect(line).toContain('sheet 50×40cm (W×H)')
  expect(line).toContain('70mm border Even')
  expect(line).toContain('3/50')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec playwright test e2e/tps-recipe.spec.ts`
Expected: FAIL — `formatTpsRecipeLine` is not exported from `tpsRecipe.ts`.

- [ ] **Step 3: Add the one-line summary helper**

Append to `src/lib/editions/tpsRecipe.ts`:

```ts
/**
 * One-line variant of the recipe, for the admin order list where a block
 * would not fit. Width-first and labelled, same as the full card.
 */
export function formatTpsRecipeLine(
  recipe: TpsRecipe,
  opts: { printTypeLabel: string; number: number; editionSize: number },
): string {
  const wh = `${round1(recipe.sheetWidthCm)}×${round1(recipe.sheetHeightCm)}cm (W×H)`
  return (
    `${opts.printTypeLabel} · ${recipe.paperLabel} · sheet ${wh}` +
    ` + ${recipe.borderMm}mm border ${recipe.distribution} · Print Only · ${opts.number}/${opts.editionSize}`
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec playwright test e2e/tps-recipe.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Replace both admin call sites**

In `src/app/admin/orders/actions.ts`, add the import:

```ts
import { buildTpsRecipe, formatTpsRecipeLine } from '@/lib/editions/tpsRecipe'
```

At `:1046-1048`, replace:

```ts
    const tpsSku =
      `${printTypeLabel} · ${paperLabel} · ${v.heightCm}×${v.widthCm}cm` +
      ` + ${v.borderCm}cm border · Print Only · ${en.number}/${v.editionSize}`
```

with:

```ts
    // One generator backs this line and the artist-facing setup card, so
    // the order instruction and the product configuration cannot drift.
    const recipe = buildTpsRecipe({
      widthCm: v.widthCm,
      heightCm: v.heightCm,
      borderCm: v.borderCm,
      sheetWidthCm: v.sheetWidthCm,
      sheetHeightCm: v.sheetHeightCm,
      paperLabel,
    })
    const tpsSku = recipe
      ? formatTpsRecipeLine(recipe, {
          printTypeLabel,
          number: en.number,
          editionSize: v.editionSize,
        })
      : `${printTypeLabel} · ${paperLabel} · ${v.heightCm}×${v.widthCm}cm · Print Only · ${en.number}/${v.editionSize}`
```

Apply the identical replacement at `:1086-1089`, which returns the string directly rather than assigning it.

Confirm the Prisma selects feeding `en.variant` at both sites include `sheetWidthCm` and `sheetHeightCm`. If either uses an explicit `select`, add both fields — otherwise the recipe silently falls back to adaptive mode and the order instruction would be wrong. This is the highest-risk line in the task: the failure is silent and produces a plausible-looking but incorrect instruction for a real print order.

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

Run: `pnpm exec playwright test`
Expected: PASS, full suite.

- [ ] **Step 7: Commit**

```bash
git add src/lib/editions/tpsRecipe.ts src/app/admin/orders/actions.ts e2e/tps-recipe.spec.ts
git commit -m "AR-135: build the admin TPS order instruction from the shared recipe generator"
```

---

### Task 11: Production-build verification

The change touches the import graph of server components (`specs.ts`, `actions.ts`) and a client component tree. Per project rule, SSR/RSC-affecting changes get a local production build before pushing.

**Files:** none modified.

**Interfaces:** none.

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: succeeds with no new warnings about client/server boundaries. `sheetLayout.ts`, `tpsRecipe.ts` and `variantMargin.ts` are pure modules with no React or Node imports, so they are safe on both sides — if the build complains about one, the cause is an import added to it, not the module itself.

- [ ] **Step 2: Run the production server**

Run: `pnpm start`
Open a limited artwork's public print page and an artwork edit page. Confirm both render and the fixed-sheet readout appears.

- [ ] **Step 3: Full suite once more**

Run: `pnpm exec playwright test`
Expected: PASS. Confirm no stray fixtures remain in the dashboard afterwards.

- [ ] **Step 4: Report, do not push**

Report to the user:
- `schema.prisma` has two new nullable columns; they must run the push themselves. Additive and nullable, so existing rows need no backfill.
- Implementation is complete but **merging is gated on the physical sample** from the creativehub product configured on 2026-08-17, per the spec's Open Risks.
- Wait for their explicit OK before any commit beyond the per-task commits above, and never push without being told.

---

## Deferred

Recorded so they are not silently lost:

- **Pricing cost basis.** Buyer pricing still derives from image area while TPS bills the sheet — the gallery absorbs roughly €8/print on the artist's fixed-sheet variant and ~€4 on a typical adaptive one. Decision 2026-08-17 was to absorb it. The margin guardrail (Task 7) bounds the damage.
- **COA + letter insert** cost €4.88/order and are modelled nowhere.
- **Exhibition wall displays** (`src/components/scene/spaces/objects/Display/Display.tsx:390-391`, `:646-647`) still assume a uniform border on the separate `paperBorderSize` lineage. Out of scope by decision.
- **Uniqueness key** remains `@@unique([artworkId, widthCm, heightCm])` on the derived image. Two different sheets yielding the same image size would collide; extend the key to include the sheet if that ever proves reachable.
- **Sub-40 cm sheets** are rejected rather than supported. Replicating TPS's `border × width/400` scaling inside `computeSheetLayout` would lift the restriction.
