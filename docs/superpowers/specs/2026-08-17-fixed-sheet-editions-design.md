# Fixed-Sheet Limited Editions — Design

**Date:** 2026-08-17
**Branch:** `feat/AR-135-set-total-size-for-artwork`
**Status:** Design — awaiting review. Implementation gated on physical sample (see Open Risks).

## Problem

An artist wants every print in a series delivered on the **same standard sheet of paper** (e.g. 40 × 50 cm), with the image sized to a nominal target inside it. The paper stays constant so the series hangs consistently in off-the-shelf frames; the image and the borders absorb each photo's ratio differences.

Our data model cannot express this. `LimitedVariant.borderCm` is a **single scalar, uniform on all four sides** (`prisma/schema.prisma:250`). A fixed sheet with a fixed image ratio necessarily produces **different horizontal and vertical borders**:

```
sheet 50 × 40, image 36 × 24  →  borders 7.0 horizontal / 8.0 vertical
```

One field cannot hold 7.0 and 8.0. This is not about tolerating variation — even a perfectly constant 3:2 image on a 5:4 sheet is unrepresentable today.

Secondary gap: neither mode shows the artist a total sheet size anywhere. The sum exists only as throwaway locals in six preview components.

## Verified supplier behaviour (theprintspace)

Confirmed live in the creativehub product wizard on 2026-08-17, for a 3:2 landscape artwork:

- Borders at TPS are **subtractive** — the sheet size is fixed and the border eats inward.
- The custom-size row is **not ratio-locked**. The height field auto-fills to match the artwork ratio, but it can be overwritten. Off-ratio sheets are accepted (the preset list already contains 29.7 × 21 and 100 × 70 against a 3:2 artwork).
- The size fields are **width × height** — the opposite of our H×W display convention.
- The border value is a **minimum** ("mm minimum" in their UI). The artwork is fitted inside `sheet − 2×border`, centred, never cropped; leftover space on the non-binding axis becomes extra border per the Distribution setting.
- "Targeted border size" is measured at a **40 cm-wide reference print**. Exact on sheets ≥ 40 cm wide, scaled *down* proportionally on narrower sheets, never scaled up.
- The border is **capped at a quarter of the sheet's shortest side**. Above that TPS silently clips.

**Working recipe:** sheet `50 × 40` (W×H), Border → Custom → **Even** → **70 mm minimum** → image **36 × 24**, borders **7.0 / 8.0**. Confirmed against the wizard's full preview.

`Aspect ratio — pad to a target shape` is *not* needed once the sheet size is entered directly; it exists for when you cannot set the sheet and want TPS to choose one matching a target ratio.

## Design

### Two modes, discriminated by nullability

No mode enum. `sheetWidthCm`/`sheetHeightCm` null → **adaptive** (current behaviour). Set → **fixed sheet**.

| | Adaptive (today, unchanged) | Fixed sheet (new) |
|---|---|---|
| Artist enters | print size + border | sheet size + minimum border |
| Derived | sheet = print + 2×border | image fits inside sheet − 2×border |
| Borders | uniform, exact | per-axis, ≥ the minimum |

A single `isFixedSheet(variant)` helper keeps call sites readable.

### Schema

Add to `LimitedVariant`:

- `sheetWidthCm  Float?`
- `sheetHeightCm Float?`

Unchanged:

- `widthCm` / `heightCm` — remain the **image** size. In fixed-sheet mode they are *derived and stored* (denormalised), so the `@@unique([artworkId, widthCm, heightCm])` key, pricing, buyer-facing specs and the admin TPS paste line keep working without modification.
- `borderCm` — remains **the number typed into TPS**. Exact-and-uniform in adaptive mode; a *minimum* in fixed-sheet mode. Documented on the field.

Existing rows need no migration: null sheet fields mean adaptive.

### The geometry helper — single source of truth

One exported function, living beside `src/lib/print-providers/printspace/sizeBounds.ts`. It must reproduce TPS's algorithm exactly, or the previews and specs promise a layout that will not arrive.

```ts
computeSheetLayout({ sheetWCm, sheetHCm, minBorderCm, aspectRatio }) => {
  sheetWCm, sheetHCm,
  imageWCm, imageHCm,     // contain(aspectRatio, inner) — never crop
  borderXCm, borderYCm,   // (sheet − image) / 2, per axis
}
```

```
inner  = (sheetW − 2b) × (sheetH − 2b)
image  = contain(aspectRatio, inner)
border = (sheet − image) / 2
```

Verified: `{50, 40, 7, 1.5}` → image `36 × 24`, borders `7.0 / 8.0`.

This helper also replaces the six ad-hoc `print + border*2` sums listed under Previews.

### Pricing — unchanged (decision 2026-08-17)

`getQuote` continues to price on **image area**. The gallery absorbs the difference between the image we price and the sheet TPS bills.

Recorded for context, not to be fixed here:

- Fixed sheet 50 × 40 with a 36 × 24 image: we price €18.34, TPS bills €26.31 → **~€8/print absorbed**.
- The same gap already exists in adaptive mode (40 × 27.9 print + 3 cm border = a 46 × 33.9 sheet): **~€4/print** absorbed today.
- COA + letter insert add **€4.88/order**, also unmodelled.

**Guardrail (required).** Free-entry sheet size plus gallery absorption makes it possible to configure a loss:

| sheet | image | absorbed gap | vs €40 gallery cut |
|---|---|---|---|
| 50 × 40 | 36 × 24 | €7.97 | €32 remaining |
| 100 × 70 | 36 × 24 | €58.21 | **−€18 loss** |

So the variant editor must show a **live production-cost and gallery-margin readout**, and **block saving when margin ≤ 0**. This keeps absorption a deliberate choice rather than a silent one.

### Validation (`src/lib/editions/validateVariant.ts`)

Fixed-sheet mode adds:

- sheet dimensions positive, within TPS bounds (`MAX_SHORT_EDGE_CM` 110.5, `MAX_LONG_EDGE_CM` 200)
- `minBorderCm >= LIMITED_BORDER_MIN_CM` (3)
- **`minBorderCm <= 0.25 × min(sheetW, sheetH)`** — TPS silently clips above this, so we reject rather than promise an unprintable layout
- **sheet width >= 40 cm** — below the TPS reference width the border is silently scaled down (see Open Risks 3)
- derived image must clear `MIN_SHORT_EDGE_CM` (20), the 300 DPI floor, and the file's printable range
- image must fit: `inner` positive on both axes
- gallery margin > 0 (see Guardrail)

Lock semantics: `saveLimitedVariants.ts` already rejects non-price changes once a variant is published. `sheetWidthCm`, `sheetHeightCm` and `borderCm` join that guarded set.

Uniqueness: the existing key is on the derived image size. Two different sheets could in principle yield the same image size; if that proves reachable, extend the key to include the sheet.

### Artist editor UI (`LimitedVariantsEditor`)

Rounded controls (artist dashboard, not buyer-facing). Lucide icons, `<Button/>`, no emoji, errors on submit only.

- A toggle for sheet mode: *derived from print + border* / *fixed sheet*
- Fixed mode reveals free numeric `HEIGHT (CM)` / `WIDTH (CM)` sheet fields — **explicitly labelled**, since free entry reintroduces the transposition risk that made a 40 × 50 vs 50 × 40 mix-up the single most likely error in this feature
- The existing border field relabels to *Minimum border (cm)* in fixed mode
- A **live readout in both modes**: `Sheet 40 × 50 cm · Image 24 × 36 cm · Borders 7.0 / 8.0 cm`, H×W throughout, plus the cost/margin line from the Guardrail

### Distribution: Even only

TPS offers Even / Bottom weighted / Aspect ratio. We model **Even only**.

- *Bottom weighted* is deliberately excluded — decision 2026-08-17.
- *Aspect ratio* is unnecessary: it exists for when you cannot set the sheet size and want TPS to choose one matching a target ratio. Since the artist enters the sheet directly, Even on an off-ratio sheet already produces the asymmetric borders that are the point of this feature.

Distribution is therefore a constant, not a stored field. It appears in the TPS reproduction card as a fixed value so the operator selects the right option.

### TPS reproduction card

The variant editor renders a read-only panel giving the **exact creativehub wizard inputs** for that variant, with a copy button. This is what makes the configuration reproducible by hand and is the primary defence against transposition errors.

```
TPS setup — Saut de l'ange · "50×40 Standard"

  Custom size (W × H)   50 × 40 cm      (19.7 × 15.7 in)
  Fit method            Add a border (keep whole artwork)
  Border size           Custom
  Distribution          Even
  Units                 Millimeters
  Targeted border       70 mm
  Paper                 Hahnemühle German Etching
  Edition type / size   Limited · 50

  Expect: image 36 × 24 cm · borders 7.0 h / 8.0 v
```

Rules for this panel:

- Dimensions are printed **W × H and explicitly labelled**, because TPS is width-first while every other surface in our app is H×W. Inches are shown alongside, since the TPS row carries both and they cross-check the cm values.
- The border is given **in mm**, matching the TPS field's units.
- The `Expect:` line is the acceptance test. If the creativehub preview disagrees, the configuration is wrong — do not proceed.
- Present for adaptive variants too, with the sheet computed as `print + 2×border` and the same Even/Custom recipe.

The same generator backs the admin TPS paste line, so the order-placement instruction and the artist-facing card can never drift apart.

### Previews — must match precisely

All six sites currently apply one scalar to both axes and would render a 3:2 sheet where a 5:4 sheet will arrive:

| file | lines |
|---|---|
| `src/components/PrintWizard/SizeSchema.tsx` | 69-70 (cm), 119-120 (px) |
| `src/components/PrintWizard/scene/PreviewArtwork.tsx` | 128-129 |
| `src/components/PrintWizard/scene/preview/StandardPreview.tsx` | 51-52 |
| `src/components/PrintWizard/scene/preview/FloatingPreview.tsx` | 61-62 |
| `src/components/PrintWizard/scene/preview/BoxPreview.tsx` | 54-55 |
| `src/components/PrintWizard/scene/preview/TrayPreview.tsx` | 66-67 |

The arithmetic change is one line split in two per site:

```
paperWidthM  = printWidthM  + borderXM * 2
paperHeightM = printHeightM + borderYM * 2
```

Backboard, mat, moulding and tray-cavity layers stack outward from `paperWidth`/`paperHeight` and stay uniform, so they inherit the asymmetry for free.

**Prop shape: add an optional second axis, don't replace the first.** Each component takes one `paperBorderM` (or `paperBorderCm`). Add `paperBorderYM?: number` defaulting to `paperBorderM`. Every existing call site then stays untouched and keeps rendering identically, and only fixed-sheet call sites pass the second value. The `Y` suffix names the axis explicitly so a crossed assignment reads as wrong at the call site.

`SizeSchema.tsx:119-120` needs the most care — its px path carries a minimum-size nudge (`borderPx`) that scales the print to fit the viewBox, and both axes must scale together or the sheet skews.

### Buyer-facing copy

For a fixed-sheet variant the **sheet becomes the headline dimension** — it is the object that arrives and the size a frame is bought for — with the image area secondary:

> 40 × 50 cm sheet · 24 × 36 cm image · 7.0 / 8.0 cm borders

Touches `src/lib/print-providers/specs.ts:78-93` (currently lists size and border as separate rows, never the sheet) and `src/components/PrintWizard/VariantPicker.tsx:44` (currently print size alone).

### Admin TPS paste line

`src/app/admin/orders/actions.ts:1046-1048` (duplicated at 1086-1089) currently emits print size + border in H×W cm. It must instead render the **TPS reproduction card** generator (above): sheet size W×H, minimum border in mm, Even/Custom, paper, edition number.

Both call sites share one generator with the artist-facing card, so the order instruction and the product configuration cannot drift. The duplication at 1086-1089 collapses into that shared call.

### Testing

Playwright specs in `/e2e/`, per project convention. No Vitest/Jest. No WebGL mounting — use the isolation pattern. Specs import the geometry constants rather than restating them.

Coverage:

- `computeSheetLayout` against the verified case (`50 × 40`, 7 cm, 3:2 → `36 × 24`, 7.0/8.0)
- width-bound and height-bound branches (image squarer / wider than the inner box)
- quarter-cap rejection
- DPI and short-edge rejection on the derived image
- margin guardrail blocks a loss-making sheet
- lock semantics reject a sheet change on a published variant
- sub-40 cm sheet rejection
- the TPS reproduction card emits W×H (not H×W) and the border in mm, for both modes

### Out of scope

`src/components/scene/spaces/objects/Display/Display.tsx:390-391` (and 646-647) does the same uniform-border math on the separate `paperBorderSize` lineage for **exhibition wall displays**, not the print wizard. Left unchanged. Revisit only if fixed-sheet editions should render in exhibitions.

## Open Risks

1. **Physical validation not done.** The geometry is confirmed against the TPS wizard's on-screen preview only. Per house rule, a physical sample must confirm the printed sheet measures 50 × 40 with a 36 × 24 image before this feature is built around it. **Implementation is gated on this.**
2. **Thin keyline in the TPS preview.** The full preview renders a fine dark outline at the image boundary. Believed to be a preview artifact, not printed. Confirm on the sample.
3. **Border scaling below 40 cm.** TPS scales the border down on sheets narrower than 40 cm (`b × width/400`). A variant with a sheet narrower than 40 cm would therefore not receive the entered minimum, and our derived layout would diverge from what TPS prints. **Decision: reject sheets narrower than 40 cm in fixed-sheet mode**, validated alongside the quarter-cap. Replicating the scaling inside `computeSheetLayout` is possible later if a smaller standard sheet is ever needed; it is deliberately excluded now because the divergence is silent and the artist's use case is 40 cm and above.
4. **Which TPS app takes editioned manual orders** (Sell vs print app) remains unresolved from 2026-07-24.
5. **Draft orderability** — whether a never-published creativehub Draft backs a manual order and the edition counter is still untested.
