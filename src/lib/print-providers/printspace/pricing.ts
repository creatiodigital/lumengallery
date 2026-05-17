/**
 * The Print Space pricing tables. Shipping is exact (transcribed from
 * TPS's published rate card). Print + frame + glass + hanging values
 * are deliberately approximate placeholders — TPS's API doesn't
 * expose live prices, so the gallery rounds slightly upward to absorb
 * any per-job variance ("if there's a difference, it leans to the
 * gallery, never the buyer").
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

// ── Print base (per size tier, approximate) ─────────────────────
//
// Single number per tier, no per-paper or per-print-type variation
// for now. The model rounds slightly upward — any per-job variance
// (e.g. paper choice within Giclée) leans to the gallery's favour,
// never the buyer's.
//
// Calibration anchors (carts, 2026-04-26):
//   30×40 Giclée German Etching → print line €19.34
//   40×57 Giclée Bamboo         → print line €25.49
//   60×86 Giclée Photo Rag      → print line €54.08
// Tier ≤84 still without a direct anchor; estimated between ≤60 and
// ≤119 anchors.
const PRINT_BASE_CENTS: readonly SizeTier<number>[] = [
  { upToLongEdgeCm: 35, value: 1700 }, // ~€17, area-scaled, unconfirmed
  { upToLongEdgeCm: 42, value: 2100 }, // €21 — anchor €19.34 + ~9% bias
  { upToLongEdgeCm: 60, value: 2800 }, // €28 — anchor €25.49 + ~10% bias
  { upToLongEdgeCm: 84, value: 4500 }, // ~€45 — interpolated, unconfirmed
  { upToLongEdgeCm: 119, value: 6000 }, // €60 — anchor €54.08 + ~11% bias
]

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
  standard: [
    { upToLongEdgeCm: 35, value: 11500 }, // ~€115, no real anchor
    { upToLongEdgeCm: 42, value: 12000 }, // €120 ← real €112 + ~7% bias
    { upToLongEdgeCm: 60, value: 15000 }, // €150 ← real €138 (30×43 cart) + ~9% bias
    { upToLongEdgeCm: 84, value: 28500 }, // €285 — interpolated above ≤60 jump
    { upToLongEdgeCm: 119, value: 30000 }, // €300 ← real €273 + ~10% bias
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
  return pickTier(PRINT_BASE_CENTS, widthCm, heightCm)
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

const ANTI_REFLECTIVE_SUPPLEMENT_CENTS: readonly SizeTier<number>[] = [
  { upToLongEdgeCm: 35, value: 5000 }, // €50
  { upToLongEdgeCm: 42, value: 5500 }, // €55 ← real €50 + bias (anchor)
  { upToLongEdgeCm: 60, value: 6500 }, // €65 — interpolated
  { upToLongEdgeCm: 84, value: 9500 }, // €95 — interpolated
  { upToLongEdgeCm: 119, value: 12000 }, // €120 ← real €110.60 + bias (anchor)
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
// Mount cost on TPS is stepped, NOT linear per cm. Three tiers
// observed at 30×43 (cart probe, 2026-04-26):
//   0 mm           → no supplement
//   3–39 mm        → +€19 (any mount under 4 cm)
//   42–60 mm       → +€24
//   63–72 mm       → +€53 (max width = 72 mm)
//
// Real cart values + ~15-20% upward bias. Currently treated as
// flat across frame sizes; may scale at larger frames but no
// confirming anchor yet.
const MOUNT_BOARD_TIERS: ReadonlyArray<{ upToCm: number; cents: number }> = [
  { upToCm: 3.9, cents: 2200 }, // €22 ← real €19 + ~15% bias
  { upToCm: 6.0, cents: 2800 }, // €28 ← real €24 + ~15% bias
  { upToCm: 7.2, cents: 6000 }, // €60 ← real €53 + ~13% bias
]

export function getMountBoardSupplementCents(mountCm: number): number {
  if (!mountCm || mountCm <= 0) return 0
  for (const tier of MOUNT_BOARD_TIERS) {
    if (mountCm <= tier.upToCm) return tier.cents
  }
  // Anything beyond max gets the largest tier (slider is capped at 7.2 cm).
  return MOUNT_BOARD_TIERS[MOUNT_BOARD_TIERS.length - 1].cents
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

// ── Shipping costs (verbatim from the rate card) ────────────────
//
// Per-order shipping for prints (any size, single line item).
export const TPS_SHIPPING_PRINTS_CENTS: Record<TpsRegion, number> = {
  UK: 695,
  DE: 695,
  EU: 1463,
  NORDIC: 1960,
  US: 2867,
  CA: 4095,
  AU_NZ: 7697,
  ROW: 7697,
}

// Per-frame shipping (a framed order ships at this rate per frame
// instead of the flat print rate above). Tiered by long-edge cm —
// thresholds match TPS's published rate card bands but stripped of
// the A4/A3/A2/A1/A0 labels (gallery's pricing model uses long-edge
// cm directly so labels don't leak anywhere internally).
const SHIPPING_FRAMES_CENTS: Record<TpsRegion, readonly SizeTier<number>[]> = {
  UK: [
    { upToLongEdgeCm: 35, value: 1463 },
    { upToLongEdgeCm: 42, value: 1463 },
    { upToLongEdgeCm: 60, value: 1697 },
    { upToLongEdgeCm: 84, value: 2399 },
    { upToLongEdgeCm: 119, value: 3510 },
  ],
  DE: [
    { upToLongEdgeCm: 35, value: 802 },
    { upToLongEdgeCm: 42, value: 1463 },
    { upToLongEdgeCm: 60, value: 1697 },
    { upToLongEdgeCm: 84, value: 2399 },
    { upToLongEdgeCm: 119, value: 3510 },
  ],
  EU: [
    { upToLongEdgeCm: 35, value: 2633 },
    { upToLongEdgeCm: 42, value: 2867 },
    { upToLongEdgeCm: 60, value: 3218 },
    { upToLongEdgeCm: 84, value: 3452 },
    { upToLongEdgeCm: 119, value: 7605 },
  ],
  NORDIC: [
    { upToLongEdgeCm: 35, value: 2062 },
    { upToLongEdgeCm: 42, value: 3452 },
    { upToLongEdgeCm: 60, value: 3803 },
    { upToLongEdgeCm: 84, value: 4083 },
    { upToLongEdgeCm: 119, value: 8775 },
  ],
  US: [
    { upToLongEdgeCm: 35, value: 2282 },
    { upToLongEdgeCm: 42, value: 2545 },
    { upToLongEdgeCm: 60, value: 3089 },
    { upToLongEdgeCm: 84, value: 3715 },
    { upToLongEdgeCm: 119, value: 4417 },
  ],
  CA: [
    { upToLongEdgeCm: 35, value: 4095 },
    { upToLongEdgeCm: 42, value: 4212 },
    { upToLongEdgeCm: 60, value: 5499 },
    { upToLongEdgeCm: 84, value: 7488 },
    { upToLongEdgeCm: 119, value: 7956 },
  ],
  AU_NZ: [
    { upToLongEdgeCm: 35, value: 5154 },
    { upToLongEdgeCm: 42, value: 8687 },
    { upToLongEdgeCm: 60, value: 11209 },
    { upToLongEdgeCm: 84, value: 17768 },
    { upToLongEdgeCm: 119, value: 21060 },
  ],
  ROW: [
    { upToLongEdgeCm: 35, value: 7694 },
    { upToLongEdgeCm: 42, value: 8687 },
    { upToLongEdgeCm: 60, value: 11209 },
    { upToLongEdgeCm: 84, value: 17768 },
    { upToLongEdgeCm: 119, value: 21060 },
  ],
}

export function getFrameShippingCents(
  region: TpsRegion,
  widthCm: number,
  heightCm: number,
): number {
  return pickTier(SHIPPING_FRAMES_CENTS[region], widthCm, heightCm)
}

// ── Delivery time (working days, per region) ────────────────────
//
// Verbatim from TPS rate card. Working days; convert to calendar
// days by ×1.4 at the consumer surface.
export const TPS_SHIPPING_DAYS: Record<TpsRegion, { min: number; max: number }> = {
  UK: { min: 3, max: 7 },
  DE: { min: 3, max: 7 },
  EU: { min: 4, max: 10 },
  NORDIC: { min: 4, max: 10 },
  US: { min: 6, max: 10 },
  CA: { min: 6, max: 10 },
  AU_NZ: { min: 5, max: 15 },
  ROW: { min: 5, max: 15 },
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

// ── VAT ─────────────────────────────────────────────────────────

export const TPS_GALLERY_MARKUP_RATE = 0.45

// Per-destination standard VAT rate. Single source of truth for both
// the checkout preview AND the PaymentIntent total — what's here is
// what the buyer is charged. Keep in sync with the official EU rates
// list (taxation-customs.europa.eu / TEDB); values below are 2025.
//
// Pre-launch accountant review pending: OSS thresholds, postal-aware
// Canary/Ceuta/Melilla zero-rating, B2B reverse-charge — see
// project_vat_todo memory.
const TPS_VAT_RATES: Record<string, number> = {
  AT: 0.2,
  BE: 0.21,
  BG: 0.2,
  HR: 0.25,
  CY: 0.19,
  CZ: 0.21,
  DK: 0.25,
  EE: 0.22,
  FI: 0.255,
  FR: 0.2,
  DE: 0.19,
  GR: 0.24,
  HU: 0.27,
  IE: 0.23,
  IT: 0.22,
  LV: 0.21,
  LT: 0.21,
  LU: 0.17,
  MT: 0.18,
  NL: 0.21,
  PL: 0.23,
  PT: 0.23,
  RO: 0.19,
  SK: 0.23,
  SI: 0.22,
  ES: 0.21,
  SE: 0.25,
  GB: 0.2,
}

/** Standard VAT rate the buyer sees at checkout for a given country.
 *  Returns 0 for any country we don't (yet) charge VAT for. */
export function getVatRate(countryCode: string): number {
  if (!countryCode) return 0
  return TPS_VAT_RATES[countryCode.toUpperCase()] ?? 0
}
