/**
 * The Print Space pricing tables.
 *
 * Shipping: transcribed from TPS's "Delivery Price list Feb 2023 EUR
 * (external use)" per-country portal rate card, COURIER service (we
 * place orders manually on the TPS portal, so the portal card — not
 * the ASF/dropship card — is what TPS charges the gallery).
 *
 * Print base: area formula fitted to TPS's published price list.
 * Frame + glass + hanging values remain approximate cart-calibrated
 * placeholders. Wherever the model approximates, it rounds upward so
 * any per-job variance leans to the gallery, never the buyer.
 *
 * All amounts in EUR cents to match the rest of the app's money type.
 */

// ── Size tiers ───────────────────────────────────────────────────
//
// Buyer-facing wizard accepts custom width × height. Internally we
// bin the order into 5 size tiers based on the long edge (cm) — TPS
// uses the same tier breakpoints in its published shipping rate
// card, so we mirror them for pricing approximation. Buyers never
// see the tier labels; they exist only in this module.
//
// Threshold is "max long edge in cm that still fits this tier".
type SizeTier<T> = { upToLongEdgeCm: number; value: T }

function pickTier<T>(tiers: readonly SizeTier<T>[], widthCm: number, heightCm: number): T {
  const longEdge = Math.max(widthCm, heightCm)
  for (const tier of tiers) {
    if (longEdge <= tier.upToLongEdgeCm) return tier.value
  }
  // Anything bigger falls into the largest tier (size cap is 150 cm
  // upstream so we never go far past the last threshold anyway).
  return tiers[tiers.length - 1].value
}

// ── Print base (measured curve) ──────────────────────────────────
//
// Anchored to REAL creativehub cart prices (German Etching, ex-VAT,
// captured 2026-07-14/15 — see project memory "TPS Pricing
// Calibration"). Verified same-price across Giclée papers (Photo Rag
// = German Etching to the cent); C-Type (Fuji Matt/Gloss) runs ~44%
// cheaper, so the Giclée curve is the cost ceiling for every paper.
//
// The curve is NOT linear in area: there's a small-print floor
// (~€15 at 30×20) and the slope steepens past ~120 cm — a straight
// line under-priced both ends. Charge = piecewise-linear through the
// measured anchors + ~8%, so variance leans to the gallery, never
// the buyer.
//
// Measured cost anchors (area cm² → EUR):
//   603→15.26 · 1072→18.32 · 1675→23.44 · 2416→25.49 ·
//   5160→54.08 (2026-04 cart) · 6690→69.39 · 9636→105.13 ·
//   11310→134.75
const PRINT_BASE_CURVE: ReadonlyArray<{ areaCm2: number; cents: number }> = [
  { areaCm2: 603, cents: 1650 },
  { areaCm2: 1072, cents: 1980 },
  { areaCm2: 1675, cents: 2530 },
  { areaCm2: 2416, cents: 2760 },
  { areaCm2: 3269, cents: 3860 }, // 70×46.7 → €35.68 (prediction-game cart, 2026-07-16)
  { areaCm2: 5160, cents: 5840 },
  { areaCm2: 6690, cents: 7500 },
  { areaCm2: 7350, cents: 7830 }, // 105×70 → €72.45 (prediction-game cart, 2026-07-16)
  { areaCm2: 9636, cents: 11350 },
  { areaCm2: 11310, cents: 14550 },
]
// Beyond the last anchor (bigger than 130×87) extend at the top
// segment's slope + margin. Catalog caps at 150 cm long edge.
const PRINT_BASE_TOP_SLOPE_CENTS_PER_CM2 = 1.9

// ── Frame supplement (per tier × frame type, approximate) ───────
//
// Frame + free D-rings hanging only. Glass priced separately (None
// and Standard glass cost the same; only Anti-Reflective adds a
// supplement).
//
// Calibration data (carts, 2026-04-26):
//   30×40 Standard Thin-White  Std glass       → total €131.49 → frame ~€112
//   40×57 Standard Thin-Oak    AR glass        → total €184.03 → frame €158.54
//                                                  (≈ €103 frame + €55 AR glass)
//   30×40 Box      Black-Square Std glass      → total €205.58 → frame ~€186
//   30×40 Floating Black-Thin   Std glass      → total €336    → frame ~€317
//   60×86 Standard Wide-Black   Std glass      → total €327.49 → frame €273
//   60×86 Box      Square-White Std glass      → total €408.45 → frame ~€354
//
// Box-vs-Standard ratio observed:
//   long edge 40 → 1.66× (€186 / €112)
//   long edge 86 → 1.30× (€354 / €273)
// Ratio shrinks at larger sizes, so per-tier Box values are derived
// per-tier rather than from a single ratio.
//
// Floating-vs-Standard observed only at long edge 40 (2.83×). Large-
// size Floating values use a similarly-shrunk ratio (~2.0× at ≤119)
// as a conservative estimate — needs validation with a real cart.
//
// All values biased 5-10% above real — variance lands in gallery's
// favour, never the buyer's.
import type { TpsFrameTypeId } from './data'

const FRAME_SUPPLEMENT_CENTS: Record<TpsFrameTypeId, readonly SizeTier<number>[]> = {
  // Re-anchored 2026-07-15 (creativehub): 80×53.5 Standard Wide-Black
  // frame-only ≈ €284 — Wide runs ~€28 over Thin, and the old values
  // were anchored mid-tier on Thin mouldings, so tier-top + Wide
  // combos sat at break-even or below. One price covers every
  // moulding within the type, so each tier must clear its WORST case
  // (top long edge, widest moulding), per the pricing principle.
  standard: [
    { upToLongEdgeCm: 35, value: 12500 }, // €125 — no real anchor; covers Wide
    { upToLongEdgeCm: 42, value: 14500 }, // €145 ← 30×43 Thin was €128; + Wide headroom
    { upToLongEdgeCm: 60, value: 19000 }, // €190 ← ~€155 Thin at 60 (interp 43→72 anchors) + Wide + bias
    { upToLongEdgeCm: 84, value: 31500 }, // €315 ← real €284 Wide @80 + ~11% bias
    { upToLongEdgeCm: 119, value: 40000 }, // €400 — NO anchor above 86 cm; extrapolated by
    // long edge from €284@80. TODO: pending ~100cm framed capture.
  ],
  box: [
    { upToLongEdgeCm: 35, value: 19000 }, // €190 (~1.66× Standard ≤35)
    { upToLongEdgeCm: 42, value: 19500 }, // €195 ← real €186 + ~5% bias (anchor)
    { upToLongEdgeCm: 60, value: 26000 }, // €260 (~1.66× Standard ≤60), unconfirmed
    { upToLongEdgeCm: 84, value: 37500 }, // €375 (~1.30× Standard ≤84), interpolated
    { upToLongEdgeCm: 119, value: 39000 }, // €390 ← real €354 + ~10% bias
  ],
  floating: [
    { upToLongEdgeCm: 35, value: 32500 }, // €325 (~2.83× Standard ≤35)
    { upToLongEdgeCm: 42, value: 32500 }, // €325 ← real €317 + ~3% bias (anchor)
    { upToLongEdgeCm: 60, value: 43500 }, // €435 (~2.83× Standard ≤60), unconfirmed
    { upToLongEdgeCm: 84, value: 56000 }, // €560 — interpolated, conservative
    { upToLongEdgeCm: 119, value: 58000 }, // €580 ← real €540 + ~7% bias (anchor)
  ],
  // Tray vs Standard follows a U-curve, not a linear ramp. At small
  // sizes the two are near parity (Standard's fixed labor dominates);
  // at mid sizes Tray is cheapest relative to Standard (~0.83×); at
  // large sizes Tray pulls ahead as Dibond mounting cost takes over.
  //
  // TPS cart data 2026-05-14:
  //   20×29 Tray Black, no glass → framing €60.08
  //                                Standard same size = €63.21 (0.95×)
  //   30×43 Tray Black, no glass → framing €106.27
  //                                Standard same size = €128.11 (0.83×)
  //   50×72 Tray Black, no glass → framing €223.78
  //                                Standard same size = €178.15 (1.26×)
  //   60×86 Tray Black, no glass → framing €373.75
  //                                Standard same size = €276.39 (1.35×)
  //
  // Four real anchors cover ≤35, ≤60, ≤84, ≤119. ≤42 interpolated.
  // All values biased ~7-10% upward for safety.
  tray: [
    { upToLongEdgeCm: 35, value: 6500 }, // €65 ← real €60 + ~8% bias (anchor)
    { upToLongEdgeCm: 42, value: 9500 }, // €95 — interpolated between ≤35 and ≤60
    { upToLongEdgeCm: 60, value: 11500 }, // €115 ← real €106 + ~9% bias (anchor)
    { upToLongEdgeCm: 84, value: 24000 }, // €240 ← real €224 + ~7% bias (anchor)
    { upToLongEdgeCm: 119, value: 41000 }, // €410 ← real €373.75 + ~10% bias (anchor)
  ],
}

export function getPrintBaseCents(widthCm: number, heightCm: number): number {
  const area = widthCm * heightCm
  const first = PRINT_BASE_CURVE[0]
  if (area <= first.areaCm2) return first.cents
  for (let i = 1; i < PRINT_BASE_CURVE.length; i++) {
    const a = PRINT_BASE_CURVE[i - 1]
    const b = PRINT_BASE_CURVE[i]
    if (area <= b.areaCm2) {
      const t = (area - a.areaCm2) / (b.areaCm2 - a.areaCm2)
      return Math.round(a.cents + t * (b.cents - a.cents))
    }
  }
  const last = PRINT_BASE_CURVE[PRINT_BASE_CURVE.length - 1]
  return Math.round(last.cents + (area - last.areaCm2) * PRINT_BASE_TOP_SLOPE_CENTS_PER_CM2)
}

export function getFrameSupplementCents(
  frameType: TpsFrameTypeId,
  widthCm: number,
  heightCm: number,
): number {
  return pickTier(FRAME_SUPPLEMENT_CENTS[frameType], widthCm, heightCm)
}

// ── Glass supplement (per glass type, tiered for AR) ────────────
//
// Confirmed 2026-04-26: None and Standard glass cost the same on
// TPS — Standard is bundled free with framing.
//
// Anti Reflective Art DOES scale with frame size (calibrated
// 2026-04-26 via direct comparison carts):
//   long edge 42 → +€50  (Std vs AR delta at A3)
//   long edge 86 → +€110 (cart €438.09 - cart €327.49 = €110.60)
// Roughly doubles from small to large; tier values bias upward.
import type { TpsGlassId } from './data'

// Re-anchored 2026-07-15 (creativehub cart): AR delta at 80 cm long
// edge = €138.65 — much steeper at size than the 2026-04 anchors
// implied (old ≤84 tier charged €95: underwater). Small-size anchor
// (€50 at 42) still consistent with April data.
const ANTI_REFLECTIVE_SUPPLEMENT_CENTS: readonly SizeTier<number>[] = [
  { upToLongEdgeCm: 35, value: 5500 }, // €55
  { upToLongEdgeCm: 42, value: 6000 }, // €60 ← real ~€50-55 + bias
  { upToLongEdgeCm: 60, value: 10500 }, // €105 — interpolated 42→80 anchors
  { upToLongEdgeCm: 84, value: 15500 }, // €155 ← real €138.65 @80 + bias
  { upToLongEdgeCm: 119, value: 21000 }, // €210 — extrapolated by long edge; no anchor yet
]

export function getGlassSupplementCents(
  glassId: TpsGlassId,
  widthCm: number,
  heightCm: number,
): number {
  if (glassId === 'anti-reflective') {
    return pickTier(ANTI_REFLECTIVE_SUPPLEMENT_CENTS, widthCm, heightCm)
  }
  // None and Standard both bundled free with framing.
  return 0
}

// ── Mount Board (passepartout) supplement ───────────────────────
//
// Re-anchored 2026-07-16 (prediction-game carts): a Small (30 mm)
// mount on a 60×40 frame cost €41.45 — TRIPLE the April 2026 probe
// (€19 at 30×43), and clearly scaled with FRAME SIZE, not just mount
// width. The old flat-by-width tiers under-charged badly (€22).
//
// Model: charge grows with the print's long edge; the Large preset
// (wider cut) carries a higher rate. Single real anchor so far
// (Small @60 → €41.45; charge €45 = +8.6%) — the Large rate is a
// conservative +33% on top. TODO: capture a Large-mount cart.
const MOUNT_SMALL_CENTS_PER_LONG_EDGE_CM = 75
const MOUNT_LARGE_CENTS_PER_LONG_EDGE_CM = 100
const MOUNT_MIN_CENTS = 2800

export function getMountBoardSupplementCents(mountCm: number, longEdgeCm: number): number {
  if (!mountCm || mountCm <= 0) return 0
  // ≥4 cm widths only occur via the Large preset (or legacy slider
  // configs, which pay the higher rate too — safe direction).
  const rate =
    mountCm >= 4 ? MOUNT_LARGE_CENTS_PER_LONG_EDGE_CM : MOUNT_SMALL_CENTS_PER_LONG_EDGE_CM
  return Math.max(MOUNT_MIN_CENTS, Math.round(longEdgeCm * rate))
}

// ── Hanging supplement (flat per hanging type) ──────────────────
//
// TPS includes hanging hardware in the frame price — choice doesn't
// affect the buyer-facing total. Confirmed by inspection (2026-04-25).
import type { TpsHangingId } from './data'

export const TPS_HANGING_SUPPLEMENT_CENTS: Record<TpsHangingId, number> = {
  none: 0,
  'd-rings-cord': 0,
  'mirror-plates': 0,
  'strap-hangers': 0,
}

// ── Shipping regions ─────────────────────────────────────────────
//
// Verbatim from TPS's rate card. ISO 3166-1 alpha-2 codes mapped to
// the named delivery region.
export type TpsRegion = 'UK' | 'DE' | 'EU' | 'NORDIC' | 'US' | 'CA' | 'AU_NZ' | 'ROW'

const COUNTRY_REGION: Record<string, TpsRegion> = {
  // UK
  GB: 'UK',
  // Germany (separate row from EU on the card)
  DE: 'DE',
  // Europe (EU) — every EU member except DE
  AT: 'EU',
  BE: 'EU',
  BG: 'EU',
  HR: 'EU',
  CY: 'EU',
  CZ: 'EU',
  DK: 'EU',
  EE: 'EU',
  FI: 'EU',
  FR: 'EU',
  GR: 'EU',
  HU: 'EU',
  IE: 'EU',
  IT: 'EU',
  LV: 'EU',
  LT: 'EU',
  LU: 'EU',
  MT: 'EU',
  NL: 'EU',
  PL: 'EU',
  PT: 'EU',
  RO: 'EU',
  SK: 'EU',
  SI: 'EU',
  ES: 'EU',
  SE: 'EU',
  // Norway + Iceland + Liechtenstein + Switzerland row
  NO: 'NORDIC',
  IS: 'NORDIC',
  LI: 'NORDIC',
  CH: 'NORDIC',
  // North America
  US: 'US',
  CA: 'CA',
  // Australia / New Zealand
  AU: 'AU_NZ',
  NZ: 'AU_NZ',
}

export function resolveTpsRegion(countryCode: string): TpsRegion {
  return COUNTRY_REGION[countryCode] ?? 'ROW'
}

// ── Shipping costs (live-verified creativehub checkout prices) ──
//
// Source: TPS "Delivery Price list Feb 2023 EUR" rate card, verified
// against LIVE creativehub carts 2026-07-14..16 — every checked cell
// matched to the cent except the US (new service, cheaper). We fulfil
// by placing orders manually on creativehub, so these are the prices
// TPS actually charges the gallery.
//
// TPS routes production to the nearest lab: London (UK + framed
// orders), Düsseldorf (EU + exports), US lab (US orders).
//
// Service basis (gallery decision 2026-07-16): STANDARD POST always
// — the gallery never books a paid courier tier. Concretely:
//  - UK prints: Royal Mail Recorded (tracked, €6.55).
//  - US prints: "Tracked Ground Delivery" (sole US service, ~€8).
//  - EU / Nordics / Canada prints: Standard Post International.
//  - AU / NZ / JP / KR prints: International Courier — the ONLY
//    service creativehub offers there (verified live).
//  - Large parcels (bands 5-6): the rate card lists no post price;
//    priced at the courier value, which caps whatever TPS charges
//    (in practice most such prints clear the free-post threshold).
//  - Framed orders: courier only (no post service exists).
// Each region takes its worst-case supported country; true outliers
// (Cyprus, Malta) get per-country overrides instead of dragging
// their whole region up.
//
// VAT/customs facts (from the live carts):
//  - EU prints ship DE→EU: no customs; destination VAT charged until
//    the gallery's ES VAT number is on the creativehub account (then
//    reverse charge — TODO: add it).
//  - US orders carry destination-state sales tax (~0-10%) on
//    production+delivery — an unrecoverable cost we absorb in margin.
//  - Framed orders ship UK→world as zero-rated exports; whether the
//    courier bills EU recipients import VAT is being tested with a
//    real order (2026-07-15).

// Parcel size bands from the rate card — BOTH dims must fit, else
// the parcel escalates to the next band. `oversize` covers anything
// beyond the last band (rate card "Above" column).
type ShippingBands = {
  bands: readonly number[] // cents, aligned with PRINT_SHIPPING_BANDS_CM
  oversize: number
}

const PRINT_SHIPPING_BANDS_CM: ReadonlyArray<{ long: number; short: number }> = [
  { long: 30, short: 24 },
  { long: 40, short: 30 },
  { long: 70, short: 50 },
  { long: 100, short: 70 },
  { long: 120, short: 100 },
  { long: 150, short: 100 },
]

function pickShippingBand(
  bandLimitsCm: ReadonlyArray<{ long: number; short: number }>,
  pricing: ShippingBands,
  widthCm: number,
  heightCm: number,
): number {
  const long = Math.max(widthCm, heightCm)
  const short = Math.min(widthCm, heightCm)
  for (let i = 0; i < bandLimitsCm.length; i++) {
    if (long <= bandLimitsCm[i].long && short <= bandLimitsCm[i].short) {
      return pricing.bands[i]
    }
  }
  return pricing.oversize
}

// Per-order shipping for prints (tube/flat parcel). One fee per
// order, set by the LARGEST parcel band in it (verified live with a
// 2-print cart, 2026-07-16 — not per item).
const SHIPPING_PRINTS_CENTS: Record<TpsRegion, ShippingBands> = {
  // Royal Mail Recorded (tracked), verified €6.55 live at 60×40.
  // No post price above 1000×700 on the rate card → courier values
  // for the two largest bands.
  UK: { bands: [655, 655, 655, 655, 2848, 2848], oversize: 9848 },
  // Deutsche Post, €5.95 verified live at 30×20.
  DE: { bands: [595, 595, 595, 756, 1485, 1485], oversize: 5440 },
  // Standard Post Intl, worst-case EU country per band (Bulgaria/
  // Baltics €10.88 small; Greece etc. €17.61 at band 4). Live-
  // verified: ES €8.78/€16.63/€16.77, IT €8.78.
  EU: { bands: [1088, 1693, 1709, 1761, 3357, 5038], oversize: 13038 },
  // Worst of NO/CH/IS/LI post per band (IS €18.45 … €33.57);
  // NO €17.43 verified live.
  NORDIC: { bands: [1845, 2517, 2676, 3357, 5038, 7000], oversize: 13038 },
  // "Tracked Ground Delivery" from the US lab — sole option. Live-
  // verified: €8.37 at 30×20 (band 1), €26.97 at 120×80 (band 5).
  // Bands 2-4 assumed flat like band 1 (matches UK/US small-parcel
  // pattern); band 6 + oversize still conservative estimates.
  // Note: US lab production runs ~10% below the EU curve we charge
  // from — that headroom absorbs the ~9% US state sales tax.
  US: { bands: [837, 837, 837, 837, 2697, 2848], oversize: 9848 },
  CA: { bands: [2015, 2052, 2280, 3046, 3679, 5038], oversize: 13038 },
  // International Courier is the ONLY service offered (verified live
  // for AU + JP: €45 small print, no post option).
  AU_NZ: { bands: [4500, 5000, 6000, 7500, 8500, 11000], oversize: 15559 },
  ROW: { bands: [4500, 5000, 6000, 7500, 8500, 11000], oversize: 15559 },
}

// creativehub waives Standard Post delivery on high-value print
// orders: PAID at €69.39 production, FREE at €72.45 (prediction-game
// bisect, 2026-07-16) → threshold ≈ €70. Unpublished, so the trigger
// compares our CHARGE (≈ cost + 8%) against the proven-free point
// ×1.08 — free shipping is only shown when TPS's own fee is provably
// zero. Prints only — a €324 framed order still paid €55. Couriers
// stay paid above the threshold; we pass the free post tier through.
export const TPS_FREE_PRINT_DELIVERY_FROM_CENTS = 7830

// Countries whose post prices sit well above their region. Cyprus
// verified live 2026-07-16 (€10.88 band 1, matching the card).
const SHIPPING_PRINTS_COUNTRY_OVERRIDE: Record<string, ShippingBands> = {
  CY: { bands: [1088, 2515, 2548, 2548, 3924, 5038], oversize: 13038 },
  MT: { bands: [1845, 2200, 2517, 3357, 3357, 5038], oversize: 13038 },
}

export function getPrintShippingCents(
  countryCode: string,
  widthCm: number,
  heightCm: number,
): number {
  const pricing =
    SHIPPING_PRINTS_COUNTRY_OVERRIDE[countryCode.toUpperCase()] ??
    SHIPPING_PRINTS_CENTS[resolveTpsRegion(countryCode)]
  return pickShippingBand(PRINT_SHIPPING_BANDS_CM, pricing, widthCm, heightCm)
}

// Per-frame express-courier shipping ("€ MOUNTING/FRAMING" tab).
// Bands are FRAME OUTER dims: 16×12″ / 30×20″ / 40×30″ (cm, rounded
// down to stay conservative). Above 40×30″ the card says "call us" —
// priced here at 1.5× the largest published band as a safe estimate.
const FRAME_SHIPPING_BANDS_CM: ReadonlyArray<{ long: number; short: number }> = [
  { long: 40, short: 30 },
  { long: 76, short: 50 },
  { long: 101, short: 76 },
]

// The card splits the world in two: UK + EU + Nordics + US at
// €25/€40/€55, and Canada / AU / NZ / Japan / Korea at
// €41.97/€83.99/€147.02.
const FRAME_SHIPPING_NEAR: ShippingBands = { bands: [2500, 4000, 5500], oversize: 8250 }
const FRAME_SHIPPING_FAR: ShippingBands = { bands: [4197, 8399, 14702], oversize: 22050 }

const SHIPPING_FRAMES_CENTS: Record<TpsRegion, ShippingBands> = {
  UK: FRAME_SHIPPING_NEAR,
  DE: FRAME_SHIPPING_NEAR,
  EU: FRAME_SHIPPING_NEAR,
  NORDIC: FRAME_SHIPPING_NEAR,
  US: FRAME_SHIPPING_NEAR,
  CA: FRAME_SHIPPING_FAR,
  AU_NZ: FRAME_SHIPPING_FAR,
  ROW: FRAME_SHIPPING_FAR,
}

// EU/Nordic members the card prices at the FAR framed rate.
const SHIPPING_FRAMES_FAR_EXCEPTIONS = new Set(['IS', 'MT', 'RO', 'BG'])

// Moulding + wrap allowance per side when estimating frame outer
// dims from the print size (mount width is passed in separately).
const FRAME_OUTER_ALLOWANCE_CM = 4

export function getFrameShippingCents(
  countryCode: string,
  widthCm: number,
  heightCm: number,
  mountWidthCm = 0,
): number {
  const iso = countryCode.toUpperCase()
  const pricing = SHIPPING_FRAMES_FAR_EXCEPTIONS.has(iso)
    ? FRAME_SHIPPING_FAR
    : SHIPPING_FRAMES_CENTS[resolveTpsRegion(iso)]
  const growCm = 2 * (FRAME_OUTER_ALLOWANCE_CM + mountWidthCm)
  return pickShippingBand(FRAME_SHIPPING_BANDS_CM, pricing, widthCm + growCm, heightCm + growCm)
}

// ── Delivery time (working days, per region) ────────────────────
//
// Transit times for the service each region is priced on — Standard
// Post everywhere it exists (see shipping table), courier for
// AU/NZ/JP/KR. Post transit from the rate card, worst supported
// country per region (EU worst = Greece 6-8; ES 4-5 matched the
// live estimate). US Tracked Ground spanned ~5-11 transit days
// live. Working days; ×1.4 to calendar days at the consumer surface.
export const TPS_SHIPPING_DAYS: Record<TpsRegion, { min: number; max: number }> = {
  UK: { min: 1, max: 2 },
  DE: { min: 1, max: 2 },
  EU: { min: 3, max: 8 },
  NORDIC: { min: 4, max: 6 },
  US: { min: 5, max: 11 },
  CA: { min: 5, max: 7 },
  AU_NZ: { min: 3, max: 4 },
  ROW: { min: 2, max: 3 },
}

// Production turnaround (working days) per format. From TPS help
// docs (10 days for framing); print-only estimated at 3 working
// days (industry norm).
export const TPS_PRODUCTION_DAYS = {
  printOnly: 3,
  framing: 10,
}

// Gallery admin overhead — manual order placement on TPS portal
// happens within ~1 working day of buyer payment.
export const GALLERY_ADMIN_DAYS = 1

// Multiplier to convert working days → calendar days.
// 5 working days ≈ 7 calendar (×1.4).
const WORKING_TO_CALENDAR_MULTIPLIER = 1.4

export function workingToCalendar(workingDays: number): number {
  return Math.ceil(workingDays * WORKING_TO_CALENDAR_MULTIPLIER)
}

// ── Supported countries ─────────────────────────────────────────
//
// Strictly the explicit rows on TPS's published shipping rate card —
// UK, EU 27, Nordic non-EU (Norway / Iceland / Liechtenstein /
// Switzerland), US, Canada, Australia + NZ. Other ISO codes are not
// offered to buyers (TPS's rate card has a "ROW" row but per gallery
// policy 2026-04-28 we don't ship outside these regions until we can
// validate transit + customs handling for each market).
export const TPS_SUPPORTED_COUNTRIES: string[] = [
  // UK
  'GB',
  // EU 27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  // Nordic non-EU + Switzerland + Liechtenstein
  'NO',
  'IS',
  'LI',
  'CH',
  // North America
  'US',
  'CA',
  // Australia / New Zealand
  'AU',
  'NZ',
  // Curated additions — high-GDP markets with reliable shipping that
  // fall under TPS's ROW shipping rate (no Africa, no Latin America
  // for now per gallery policy 2026-04-28).
  'JP',
  'KR',
]

// ── Gallery commission ──────────────────────────────────────────

// The gallery's markup on the artist's price: gallery cut = artist price ×
// this rate. 40% per the artist↔gallery contract (was 0.45).
export const TPS_GALLERY_MARKUP_RATE = 0.4

export const HOME_VAT_RATE = 0.21 // Spain; gallery is a Spanish seller (B2C, pre-OSS)

// EU-27 (VAT territory). UK excluded (post-Brexit -> export).
export const EU_VAT_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
])

/**
 * Output VAT the gallery (Spanish seller) charges the buyer.
 * B2C, below OSS threshold: EU buyer -> 21% Spanish; non-EU -> 0% export.
 * Canary/Ceuta/Melilla 0% edge case deferred (flag for gestor).
 */
export function getVatRate(countryCode: string): number {
  if (!countryCode) return 0
  return EU_VAT_COUNTRIES.has(countryCode.toUpperCase()) ? HOME_VAT_RATE : 0
}
