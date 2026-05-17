/**
 * Convert The Print Space's hardcoded data into the canonical
 * provider-agnostic `Catalog` shape consumed by the wizard.
 *
 * Built up incrementally — only dimensions whose data has been
 * supplied by the artist appear here. Missing dimensions simply
 * aren't rendered.
 */
import type {
  AvailabilityCheck,
  BorderDimension,
  Catalog,
  EnumDimension,
  Option,
  SizeDimension,
  VisualHints,
} from '../types'
import {
  TPS_BORDER_BOUNDS,
  TPS_FORMATS,
  TPS_FRAME_TYPES,
  TPS_GLASS_OPTIONS,
  TPS_HANGING_OPTIONS,
  TPS_MOULDINGS,
  TPS_MOUNT_BOARD_BOUNDS,
  TPS_PAPERS,
  TPS_PRINT_TYPES,
  TPS_SIZE_BOUNDS,
  TPS_WINDOW_MOUNTS,
  type TpsFrameTypeId,
} from './data'
import { TPS_SUPPORTED_COUNTRIES } from './pricing'

type BuildInput = {
  imageWidthPx: number
  imageHeightPx: number
}

export function buildPrintspaceCatalog(_input: BuildInput): Catalog {
  // ── Print type ──────────────────────────────────────────────
  const printTypeOptions: Option[] = TPS_PRINT_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
  }))

  // ── Paper (cascades on print type via Option.visibleWhen) ──
  const paperOptions: Option[] = TPS_PAPERS.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    visibleWhen: { dimensionId: 'printType', valueIn: [p.printType] },
    visual: { paperRoughness: p.paperRoughness },
  }))

  // ── Format (Print Only vs Framing) ──────────────────────────
  const formatOptions: Option[] = TPS_FORMATS.map((f) => ({
    id: f.id,
    label: f.label,
    description: f.description,
    isDefault: f.id === 'framing',
    visual: { framed: f.framed },
  }))

  // ── Frame Type (only visible when Format = Framing) ─────────
  // Per-type moulding silhouette so the 3D preview reads differently
  // for Standard / Box / Floating / Tray without bespoke geometry.
  const FRAME_TYPE_VISUALS: Record<TpsFrameTypeId, VisualHints> = {
    standard: { mouldingWidthCm: 2.0, mouldingDepthCm: 2.2 },
    box: { mouldingWidthCm: 2.0, mouldingDepthCm: 5.5 },
    floating: { mouldingWidthCm: 1.4, mouldingDepthCm: 3.2 },
    tray: { mouldingWidthCm: 1.5, mouldingDepthCm: 5.0 },
  }
  const frameTypeOptions: Option[] = TPS_FRAME_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    tooltipHeaderImageUrl: t.helperImageUrl,
    visual: FRAME_TYPE_VISUALS[t.id],
  }))

  // ── Moulding (visible when framing; options cascade on frameType) ─
  // Per-moulding `mouldingWidthCm` makes the preview read differently
  // for Thin / Square / Wide / Large profiles, since `collectVisualHints`
  // is order-merged and `moulding` comes after `frameType` — so this
  // overrides the per-frame-type default. The numbers are illustrative
  // (TPS doesn't publish exact moulding widths in the public catalog),
  // tuned to make the visual difference clear without being unrealistic.
  const inferMouldingWidthCm = (mouldingId: string): number => {
    if (mouldingId.endsWith('-large')) return 4.5
    if (mouldingId.endsWith('-wide-rounded') || mouldingId.endsWith('-wide')) return 3.5
    if (mouldingId.endsWith('-square')) return 2.5
    if (mouldingId.endsWith('-small')) return 2.0
    if (mouldingId.endsWith('-thin-rounded') || mouldingId.endsWith('-thin')) return 1.4
    return 2.0
  }
  const mouldingOptions: Option[] = TPS_MOULDINGS.map((m) => ({
    id: m.id,
    label: m.label,
    visibleWhen: { dimensionId: 'frameType', valueIn: [m.frameType] },
    isDefault: m.id === 'std-black-thin',
    visual: {
      frameColorHex: m.hex,
      frameRoughness: m.roughness,
      mouldingWidthCm: inferMouldingWidthCm(m.id),
    },
  }))

  // ── Glass (visible when framing; same 3 options across all frame types) ─
  const glassOptions: Option[] = TPS_GLASS_OPTIONS.map((g) => ({
    id: g.id,
    label: g.label,
    description: g.description,
  }))

  // ── Hanging (visible when framing; same 4 options across frame types) ─
  const hangingOptions: Option[] = TPS_HANGING_OPTIONS.map((h) => ({
    id: h.id,
    label: h.label,
    description: h.description,
  }))

  // ── Window Mount / Passepartout colour (visible when framing) ─
  const windowMountOptions: Option[] = TPS_WINDOW_MOUNTS.map((w) => ({
    id: w.id,
    label: w.label,
    visual: w.id === 'none' ? undefined : { matColorHex: w.hex },
  }))

  // Visibility list for "anything except 'none'" — used to gate the
  // mount-board-size input so it only appears when a colour is picked.
  const windowMountColourIds = TPS_WINDOW_MOUNTS.filter((w) => w.id !== 'none').map((w) => w.id)

  // Dimension order mirrors TPS's "Order Prints" flow: paper-type
  // first, then print size + paper border, then mounting/framing
  // and all its sub-options, then orientation.
  const dimensions: Catalog['dimensions'] = [
    {
      kind: 'enum',
      id: 'printType',
      label: 'Print type',
      options: printTypeOptions,
    } satisfies EnumDimension,
    {
      kind: 'enum',
      id: 'paper',
      label: 'Paper',
      options: paperOptions,
    } satisfies EnumDimension,
    // TPS sells custom-only sizes — no presets, aspect ratio locked
    // to the artwork's so the buyer never gets a crop or pad.
    {
      kind: 'size',
      id: 'size',
      label: 'Print size',
      options: [],
      custom: {
        minCm: TPS_SIZE_BOUNDS.minCm,
        maxCm: TPS_SIZE_BOUNDS.maxCm,
        stepCm: TPS_SIZE_BOUNDS.stepCm,
        aspectLocked: true,
      },
    } satisfies SizeDimension,
    // Paper border — uniform on all four sides (no asymmetric).
    {
      kind: 'border',
      id: 'border',
      label: 'Paper border',
      minCm: TPS_BORDER_BOUNDS.minCm,
      maxCm: TPS_BORDER_BOUNDS.maxCm,
      stepCm: TPS_BORDER_BOUNDS.stepCm,
      defaultCm: TPS_BORDER_BOUNDS.defaultCm,
      helpText:
        'Extra white space printed on the paper around the image — same paper, same size on every side. This is not a passepartout (separate mat board); it just makes the printed sheet larger than the image.',
    } satisfies BorderDimension,
    {
      kind: 'enum',
      id: 'format',
      label: 'Mounting / Framing',
      options: formatOptions,
    } satisfies EnumDimension,
    // Frame Type — only visible when format=framing.
    {
      kind: 'enum',
      id: 'frameType',
      label: 'Frame type',
      options: frameTypeOptions,
      visibleWhen: { dimensionId: 'format', valueIn: ['framing'] },
    } satisfies EnumDimension,
    // Moulding — visible when framing; options cascade by frameType.
    {
      kind: 'enum',
      id: 'moulding',
      label: 'Moulding',
      options: mouldingOptions,
      visibleWhen: { dimensionId: 'format', valueIn: ['framing'] },
    } satisfies EnumDimension,
    // Glass — only meaningful for the three glazed frame styles.
    // Tray is open-faced (no glass), so this dropdown is hidden when
    // Tray is selected. Cascades transitively to print-only via
    // frameType's own format='framing' rule.
    {
      kind: 'enum',
      id: 'glass',
      label: 'Glass',
      options: glassOptions,
      visibleWhen: { dimensionId: 'frameType', valueIn: ['standard', 'box', 'floating'] },
    } satisfies EnumDimension,
    // Window Mount (passepartout) — only meaningful for frame styles
    // that put the print behind glass with a window-cut card around
    // it (Standard, Box). Floating frames use a visible Dibond
    // backboard around the print instead; TPS hides this dropdown
    // for Floating, and we match that. Cascades transitively to
    // print-only via frameType's own format='framing' rule.
    {
      kind: 'enum',
      id: 'windowMount',
      label: 'Mount (Passepartout)',
      options: windowMountOptions,
      visibleWhen: { dimensionId: 'frameType', valueIn: ['standard', 'box'] },
    } satisfies EnumDimension,
    // Mount board size — uniform width of the passepartout in cm.
    // Visible only when a window-mount colour is chosen (not 'none').
    {
      kind: 'border',
      id: 'windowMountSize',
      label: 'Mount (Passepartout) Size',
      minCm: TPS_MOUNT_BOARD_BOUNDS.minCm,
      maxCm: TPS_MOUNT_BOARD_BOUNDS.maxCm,
      stepCm: TPS_MOUNT_BOARD_BOUNDS.stepCm,
      defaultCm: TPS_MOUNT_BOARD_BOUNDS.defaultCm,
      visibleWhen: { dimensionId: 'windowMount', valueIn: windowMountColourIds },
    } satisfies BorderDimension,
    // Hanging — visible when framing. Last so it sits after all
    // visual choices (frame / glass / mount).
    {
      kind: 'enum',
      id: 'hanging',
      label: 'Hanging',
      options: hangingOptions,
      visibleWhen: { dimensionId: 'format', valueIn: ['framing'] },
    } satisfies EnumDimension,
    // No orientation dimension — TPS sells custom W × H. Whether the
    // print is portrait or landscape is implicit in the buyer's typed
    // dimensions (W < H = portrait; W > H = landscape). Confirmed
    // against TPS's "Order Prints" help doc + cart spec strings,
    // 2026-04-27. The dimension stays implicit in the buyer's typed W×H.
    // are aspect-fixed but rotation-free.
  ]

  return {
    providerId: 'printspace',
    currency: 'EUR',
    dimensions,
    // ISO codes from the TPS shipping rate card (UK, EU + Germany,
    // Nordic, US, Canada, AU/NZ) plus a curated ROW set for the major
    // markets we'll ship to.
    supportedCountries: TPS_SUPPORTED_COUNTRIES,
  }
}

/**
 * Synchronous availability check for TPS. Currently a no-op: as long
 * as the option's `visibleWhen` rule passes (handled upstream by the
 * generic config helpers) it's available. Once we wire shipping
 * regions, country-specific filtering layers on top.
 */
export function buildPrintspaceAvailability(): AvailabilityCheck {
  return () => true
}
