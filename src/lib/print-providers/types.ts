/**
 * Provider-agnostic contract between the print wizard and the underlying
 * fulfillment service (currently theprintspace, but the abstraction is
 * preserved so swapping in a future adapter stays low-risk).
 *
 * The wizard imports ONLY this file. The adapter lives under its own
 * folder (`printspace/`) and exposes nothing the wizard sees beyond what's
 * declared here.
 */

export type ProviderId = 'printspace'

// ── Catalog shape ────────────────────────────────────────────────

export type Catalog = {
  providerId: ProviderId
  currency: string
  /** Dimensions rendered in this exact order as wizard steps. */
  dimensions: Dimension[]
  /** Every country any combination in this catalog can be shipped to. */
  supportedCountries: string[]
  /**
   * Adapter-private data the wizard ferries client-side so the
   * availability dispatcher can rebuild a sync `AvailabilityCheck`
   * without round-tripping the server. The wizard treats this as
   * opaque — only the provider's own builder reads it.
   */
  providerData?: unknown
}

export type Dimension = EnumDimension | SizeDimension | OrientationDimension | BorderDimension

export type DimensionBase = {
  id: string
  label: string
  /** Hide the entire step until the parent dimension has one of these values. */
  visibleWhen?: { dimensionId: string; valueIn: string[] }
}

export type EnumDimension = DimensionBase & {
  kind: 'enum'
  options: Option[]
  /** Optional helper text shown under the step. */
  helpText?: string
}

export type SizeDimension = DimensionBase & {
  kind: 'size'
  options: SizeOption[]
  /**
   * When set, the wizard exposes width/height inputs alongside (or
   * instead of) the preset list. Provider decides whether to lock the
   * inputs to the artwork's aspect ratio.
   */
  custom?: {
    minCm: number
    maxCm: number
    stepCm: number
    /** Lock width and height to the artwork's natural aspect ratio. */
    aspectLocked?: boolean
  }
}

export type OrientationDimension = DimensionBase & {
  kind: 'orientation'
}

/**
 * White space added on the print paper around the image — not a
 * separate mat (passepartout). Each side independent, all in cm.
 * The print's paper size = imageWidth + leftCm + rightCm,
 * imageHeight + topCm + bottomCm.
 */
export type BorderDimension = DimensionBase & {
  kind: 'border'
  minCm: number
  maxCm: number
  stepCm: number
  /** Default per-side value (cm) when the buyer hasn't touched anything. */
  defaultCm: number
  /** Optional helper text shown under the step. */
  helpText?: string
}

// ── Options ──────────────────────────────────────────────────────

export type Option = {
  id: string
  label: string
  /** Long-form description shown in the step's tooltip. */
  description?: string
  /** Optional asset URL rendered in the tooltip alongside the description. */
  tooltipImageUrl?: string
  /** Optional asset URL rendered at the top of the tooltip body, full
   *  width. Used for the frame-type helper popups where the image
   *  illustrates the construction style. */
  tooltipHeaderImageUrl?: string
  /** Hide this option until the parent dimension has one of these values. */
  visibleWhen?: { dimensionId: string; valueIn: string[] }
  /**
   * Marks the preferred starting option for this dimension. When set,
   * `buildInitialConfig` picks this over array order. If the marked
   * option is restricted (artist-vetoed) the first allowed option is
   * used instead.
   */
  isDefault?: boolean
  /**
   * Visual hints used by the 3D preview. Adapters set the keys their
   * options need; the preview reads what it can find. Unknown keys are
   * ignored — keeps the preview decoupled from any specific adapter's
   * vocabulary.
   */
  visual?: VisualHints
}

export type SizeOption = Option & {
  widthCm: number
  heightCm: number
  /**
   * Aspect-ratio fit bucket for this size relative to the artwork. Set
   * by the adapter (it's the one that knows the artwork ratio at catalog
   * build time). 'mismatch' = neither orientation matches; will need
   * crop or pad on the print.
   */
  fit: 'perfect' | 'close' | 'mismatch'
  /** Hide if the source image can't print at this size at min DPI. */
  printEligible: boolean
}

/**
 * Visual hints attached to options that the 3D preview can use. None of
 * these are required — the preview falls back to neutral defaults when
 * an option doesn't supply them.
 */
export type VisualHints = {
  /** Frame color hex (e.g. '#0b0b0b'). */
  frameColorHex?: string
  /** Frame material roughness for PBR rendering. */
  frameRoughness?: number
  /** Visible mat (passepartout) border, in cm. 0 = no mat. */
  matBorderCm?: number
  /** Mat color hex. */
  matColorHex?: string
  /** Frame moulding width on the front face, in cm. */
  mouldingWidthCm?: number
  /** Frame depth from the wall, in cm. */
  mouldingDepthCm?: number
  /** Print paper roughness (matte papers ~0.85, satin ~0.7). */
  paperRoughness?: number
  /** Print paper sheen / metalness. */
  paperSheen?: number
  /** Marker that this option produces a framed result. */
  framed?: boolean
  /** Marker that this option produces a mat. */
  hasMat?: boolean
}

// ── Config (the wizard's state) ──────────────────────────────────

/**
 * The buyer's current selection. A flat map of `dimensionId → optionId`.
 * Provider-agnostic — the wizard manipulates this shape; adapters
 * interpret it for quotes and order specs.
 */
export type WizardConfig = {
  values: Record<string, string>
  /** Custom size when the size dimension is in custom mode. */
  customSize?: { widthCm: number; heightCm: number }
  /**
   * Per-border-dimension uniform value, in cm, keyed by dimension id.
   * Catalogs can declare multiple `border`-kind dimensions (e.g. TPS
   * has both `border` for paper border and `windowMountSize` for mat
   * width). Each is uniform on all four sides — no asymmetric inputs.
   */
  borders?: Record<string, { allCm: number }>
}

// ── Quotes ───────────────────────────────────────────────────────

/**
 * Adapter-computed price breakdown. The wizard renders only the pre-tax
 * `subtotal`; the payment step renders `total` (with tax). Lines are an
 * ordered breakdown for display in either surface.
 */
export type Quote = {
  currency: string
  lines: QuoteLine[]
  subtotalCents: number
  taxCents: number
  taxLabel?: string
  totalCents: number
}

export type QuoteLine = {
  id: string
  label: string
  amountCents: number
  /** Render this line in muted/secondary style (e.g. shipping). */
  muted?: boolean
}

// ── Availability ─────────────────────────────────────────────────

/**
 * Adapter-supplied predicate: given the current config + country, can
 * `value` for `dimensionId` be picked? The wizard uses this to filter
 * options without knowing how the adapter encodes its availability.
 */
export type AvailabilityCheck = (
  dimensionId: string,
  optionId: string,
  config: WizardConfig,
  country: string,
) => boolean

// ── Provider contract ────────────────────────────────────────────

export type LoadCatalogInput = {
  /** Pixel dimensions of the source image — drives size fit + DPI eligibility. */
  imageWidthPx: number
  imageHeightPx: number
}

export type GetQuoteInput = {
  config: WizardConfig
  country: string
  /** Artist's per-print share, in cents. Provider folds this into pricing. */
  artistPriceCents: number
}

export interface PrintProvider {
  id: ProviderId
  loadCatalog(input: LoadCatalogInput): Promise<Catalog>
  /**
   * Synchronous availability check derived from a loaded catalog. The
   * wizard will hold the resolved catalog and call this to filter
   * options as the buyer changes selections. Implementations should be
   * cheap (no network) — cache anything heavy in `loadCatalog`.
   */
  buildAvailability(catalog: Catalog): AvailabilityCheck
  getQuote(input: GetQuoteInput): Promise<Quote>
  /**
   * End-to-end delivery estimate for a given config + country, as a
   * range in calendar days. The wizard surfaces this in the summary
   * panel so the buyer sees realistic expectations before checkout.
   * Should include: gallery admin processing + provider production +
   * shipping window. Synchronous — no network calls.
   */
  estimateDelivery(config: WizardConfig, country: string): DeliveryEstimate
}

export type DeliveryEstimate = {
  minDays: number
  maxDays: number
}

// ── Per-artwork restrictions ─────────────────────────────────────

/**
 * Artist-controlled allow-lists per dimension. A flat
 * `dimensionId → allowedOptionIds` map. Empty / missing key = no
 * restriction. Stored on `Artwork.printOptions` as JSON. The provider's
 * dimension ids govern interpretation — restrictions are scoped to
 * whatever provider the artwork is configured with.
 */
export type PrintRestrictions = {
  allowed?: Record<string, string[]>
}

/**
 * Artist-controlled "recommended" markers. Soft hint surfaced in the
 * buyer's wizard (check-circle next to the option) — does NOT filter
 * availability. Distinct from `PrintRestrictions`, which hard-removes
 * options. Stored on `Artwork.printRecommendations` as JSON. Today only
 * paper IDs are supported; other dimensions can be added later without
 * a schema change.
 */
export type PrintRecommendations = {
  paper?: string[]
}
