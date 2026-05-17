/**
 * Provider-agnostic helpers operating on the canonical `Catalog` +
 * `WizardConfig`. Used by the wizard to:
 *   - decide which steps are visible
 *   - filter the options inside each step (visibility + availability + restrictions)
 *   - find a sane initial config when the buyer picks a country
 *   - keep the buyer's selection close to their previous picks when
 *     country changes
 */
import type {
  AvailabilityCheck,
  BorderDimension,
  Catalog,
  Dimension,
  EnumDimension,
  Option,
  PrintRestrictions,
  SizeDimension,
  SizeOption,
  WizardConfig,
} from './types'

// ── Visibility ───────────────────────────────────────────────────

/** Evaluate `visibleWhen` against the current config. `undefined` ≡ visible. */
function passesVisibility(
  rule: { dimensionId: string; valueIn: string[] } | undefined,
  config: WizardConfig,
): boolean {
  if (!rule) return true
  const current = config.values[rule.dimensionId]
  if (current === undefined) return false
  return rule.valueIn.includes(current)
}

/**
 * A dimension is visible when its own `visibleWhen` passes AND — if a
 * catalog is provided — the parent dimension it depends on is itself
 * visible. Without the transitive check, stale values persist across
 * choices (e.g. switching format=framing → print-only leaves a mount
 * colour set, so `windowMountSize` would otherwise stay visible).
 */
export function isDimensionVisible(
  dim: Dimension,
  config: WizardConfig,
  catalog?: Catalog,
): boolean {
  if (!passesVisibility(dim.visibleWhen, config)) return false
  if (catalog && dim.visibleWhen) {
    const parent = catalog.dimensions.find((d) => d.id === dim.visibleWhen!.dimensionId)
    if (parent && !isDimensionVisible(parent, config, catalog)) return false
  }
  return true
}

export function isOptionVisible(option: Option, config: WizardConfig): boolean {
  return passesVisibility(option.visibleWhen, config)
}

// ── Restrictions ─────────────────────────────────────────────────

export function dimensionAllowList(
  restrictions: PrintRestrictions | null | undefined,
  dimensionId: string,
): readonly string[] | undefined {
  if (!restrictions?.allowed) return undefined
  const list = restrictions.allowed[dimensionId]
  if (!list || list.length === 0) return undefined
  return list
}

export function isOptionAllowed(
  optionId: string,
  dimensionId: string,
  restrictions: PrintRestrictions | null | undefined,
): boolean {
  const allowed = dimensionAllowList(restrictions, dimensionId)
  if (!allowed) return true
  return allowed.includes(optionId)
}

// ── Combined option filter ───────────────────────────────────────

export type FilterContext = {
  dimensionId: string
  config: WizardConfig
  country: string
  availability: AvailabilityCheck
  restrictions?: PrintRestrictions | null
}

/**
 * The full filter chain that drives every dropdown's visible options:
 *   1. option-level `visibleWhen` (cascade with parent dimensions)
 *   2. artist's restrictions (allow-list)
 *   3. provider availability (ships-to-country)
 *
 * `country === ''` skips availability — used pre-country to show
 * everything the artwork allows regardless of destination.
 */
export function isOptionPickable<O extends Option>(option: O, ctx: FilterContext): boolean {
  if (!isOptionVisible(option, ctx.config)) return false
  if (!isOptionAllowed(option.id, ctx.dimensionId, ctx.restrictions)) return false
  if (ctx.country && !ctx.availability(ctx.dimensionId, option.id, ctx.config, ctx.country))
    return false
  return true
}

// ── Helpers ──────────────────────────────────────────────────────

export function findEnumDimension(catalog: Catalog, id: string): EnumDimension | undefined {
  const dim = catalog.dimensions.find((d) => d.id === id)
  return dim?.kind === 'enum' ? dim : undefined
}

export function findSizeDimension(catalog: Catalog): SizeDimension | undefined {
  return catalog.dimensions.find((d) => d.kind === 'size') as SizeDimension | undefined
}

export function findBorderDimension(catalog: Catalog, id?: string): BorderDimension | undefined {
  return catalog.dimensions.find(
    (d) => d.kind === 'border' && (id === undefined || d.id === id),
  ) as BorderDimension | undefined
}

/**
 * The buyer's currently selected print size in cm. Reads from the
 * size dimension's preset (if a preset is selected) or from
 * `config.customSize` when the size dimension is in custom mode and
 * the buyer has typed a value. Returns null if no size is resolvable
 * — typically pre-country / first render.
 */
export function getEffectiveSizeCm(
  catalog: Catalog,
  config: WizardConfig,
): { widthCm: number; heightCm: number } | null {
  const dim = findSizeDimension(catalog)
  if (!dim) return null
  const presetId = config.values[dim.id]
  if (presetId) {
    const preset = dim.options.find((o) => o.id === presetId)
    if (preset) return { widthCm: preset.widthCm, heightCm: preset.heightCm }
  }
  if (config.customSize) {
    return { widthCm: config.customSize.widthCm, heightCm: config.customSize.heightCm }
  }
  return null
}

/**
 * Uniform border value (cm) for the given border-dimension id.
 * Returns 0 when not set. The default id matches the first border
 * dimension declared by the catalog (e.g. paper border).
 */
export function getEffectiveBorderCm(config: WizardConfig, dimensionId = 'border'): number {
  return config.borders?.[dimensionId]?.allCm ?? 0
}

/**
 * Effective passepartout (mat) width in cm. Reads from the
 * `windowMountSize` border dim when present (TPS), else falls back
 * to the visual hint `matBorderCm` from the currently-selected
 * options (catalog visual hints).
 */
export function getEffectiveMatCm(catalog: Catalog, config: WizardConfig): number {
  const explicit = config.borders?.['windowMountSize']?.allCm
  if (explicit !== undefined) return explicit
  const visuals = collectVisualHints(catalog, config)
  return visuals.matBorderCm ?? 0
}

/**
 * Merge `visual` hints from every currently-selected enum option in
 * the catalog. Lets the 3D preview and size schema read frame /
 * paper / mat properties without knowing which provider's dimensions
 * supplied them — the catalog's enum dimensions can carry
 * dimension both produce `frameColorHex` and the merge picks
 * whichever is set. Later dimensions override earlier ones.
 */
export function collectVisualHints(
  catalog: Catalog,
  config: WizardConfig,
): import('./types').VisualHints {
  const merged: import('./types').VisualHints = {}
  for (const dim of catalog.dimensions) {
    if (dim.kind !== 'enum') continue
    if (!isDimensionVisible(dim, config, catalog)) continue
    const value = config.values[dim.id]
    if (!value) continue
    const option = dim.options.find((o) => o.id === value)
    const visual = option?.visual
    if (!visual) continue
    Object.assign(merged, visual)
  }
  return merged
}

// ── Defaults + initial config ────────────────────────────────────

/**
 * Build a fresh starting config: pick the first option in each enum
 * dimension, the first DPI-eligible size with the best aspect fit, and
 * orientation derived from the image. Restrictions are applied per
 * dimension. Pre-country: doesn't consider availability.
 */
export function buildInitialConfig(
  catalog: Catalog,
  aspectRatio: number,
  restrictions?: PrintRestrictions | null,
): WizardConfig {
  const values: Record<string, string> = {}
  let customSize: WizardConfig['customSize']
  let borders: WizardConfig['borders']
  for (const dim of catalog.dimensions) {
    if (dim.kind === 'enum') {
      const pick = pickInitialOption(dim, restrictions)
      if (pick) values[dim.id] = pick.id
    } else if (dim.kind === 'size') {
      const pick = pickInitialSize(dim, aspectRatio, restrictions)
      if (pick) {
        values[dim.id] = pick.id
      } else if (dim.custom) {
        // No presets — start at a sensible default size respecting
        // the artwork's aspect ratio (~30 cm on the long edge).
        const longEdge = Math.min(30, dim.custom.maxCm)
        const isPortrait = aspectRatio < 1
        const widthCm = isPortrait ? longEdge * aspectRatio : longEdge
        const heightCm = isPortrait ? longEdge : longEdge / aspectRatio
        customSize = {
          widthCm: clampCm(widthCm, dim.custom.minCm, dim.custom.maxCm, dim.custom.stepCm),
          heightCm: clampCm(heightCm, dim.custom.minCm, dim.custom.maxCm, dim.custom.stepCm),
        }
      }
    } else if (dim.kind === 'orientation') {
      values[dim.id] = aspectRatio < 1 ? 'portrait' : 'landscape'
    } else if (dim.kind === 'border') {
      borders = { ...(borders ?? {}), [dim.id]: { allCm: dim.defaultCm } }
    }
  }
  return { values, customSize, borders }
}

function clampCm(value: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, value))
  // Snap to step precision (e.g. 0.1 cm = mm precision).
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step))
  return Number(clamped.toFixed(decimals))
}

export { clampCm }

function pickInitialOption(
  dim: EnumDimension,
  restrictions: PrintRestrictions | null | undefined,
): Option | undefined {
  const allowed = dim.options.filter((o) => isOptionAllowed(o.id, dim.id, restrictions))
  return allowed.find((o) => o.isDefault) ?? allowed[0] ?? dim.options[0]
}

function pickInitialSize(
  dim: SizeDimension,
  aspectRatio: number,
  restrictions: PrintRestrictions | null | undefined,
): SizeOption | undefined {
  const allowed = dim.options.filter(
    (o) => o.printEligible && isOptionAllowed(o.id, dim.id, restrictions),
  )
  // Bias toward biggest size with the best aspect fit.
  const buckets: Record<SizeOption['fit'], SizeOption[]> = {
    perfect: [],
    close: [],
    mismatch: [],
  }
  for (const o of allowed) buckets[o.fit].push(o)
  return (
    [...buckets.perfect].reverse()[0] ??
    [...buckets.close].reverse()[0] ??
    [...buckets.mismatch].reverse()[0] ??
    dim.options[0]
  )
}

// ── Country-aware adjustments ────────────────────────────────────

/**
 * Does this exact config ship? Confirms each dimension's current value
 * passes the availability check given the others.
 */
export function configShipsTo(
  catalog: Catalog,
  config: WizardConfig,
  country: string,
  availability: AvailabilityCheck,
): boolean {
  if (!country) return false
  for (const dim of catalog.dimensions) {
    if (dim.kind === 'orientation') continue
    if (dim.kind === 'border') continue
    if (!isDimensionVisible(dim, config, catalog)) continue
    if (dim.kind === 'size') {
      // Size is satisfied either by a preset or by customSize. The
      // adapter's availability check is keyed by preset id; when in
      // custom mode we trust the catalog's own bounds (already
      // enforced at input time) and skip the per-id check.
      const value = config.values[dim.id]
      if (value) {
        if (!availability(dim.id, value, config, country)) return false
        continue
      }
      if (dim.custom && config.customSize) continue
      return false
    }
    const value = config.values[dim.id]
    if (value === undefined) return false
    if (!availability(dim.id, value, config, country)) return false
  }
  return true
}

/**
 * Find a config that ships to `country`, staying as close as possible
 * to `preferred`. Iterates allowed options per dimension; returns null
 * when nothing satisfies (availability × restrictions).
 */
export function findShippableConfig(
  catalog: Catalog,
  preferred: WizardConfig,
  country: string,
  availability: AvailabilityCheck,
  restrictions?: PrintRestrictions | null,
): WizardConfig | null {
  // Cartesian product over visible dimensions; exits early once a
  // shipping config is found. With ~6 dimensions and a handful of
  // options each this is fast enough for an interactive wizard.
  const dims = catalog.dimensions.filter((d) => d.kind !== 'orientation')

  type Candidate = { config: WizardConfig; cost: number }
  let best: Candidate | null = null

  const recurse = (idx: number, working: WizardConfig) => {
    if (idx >= dims.length) {
      if (!configShipsTo(catalog, working, country, availability)) return
      const cost = diffCost(working, preferred)
      if (!best || cost < best.cost) best = { config: working, cost }
      return
    }
    const dim = dims[idx]
    if (!isDimensionVisible(dim, working, catalog)) {
      // Dimension hidden under current values → carry through.
      recurse(idx + 1, working)
      return
    }
    const candidates = enumerateOptions(dim, working, restrictions)
    for (const optionId of candidates) {
      recurse(idx + 1, {
        ...working,
        values: { ...working.values, [dim.id]: optionId },
      })
    }
  }

  recurse(0, { ...preferred, values: { ...preferred.values } })
  return best ? (best as Candidate).config : null
}

function enumerateOptions(
  dim: Dimension,
  config: WizardConfig,
  restrictions: PrintRestrictions | null | undefined,
): string[] {
  if (dim.kind === 'enum') {
    return dim.options
      .filter((o) => isOptionVisible(o, config))
      .filter((o) => isOptionAllowed(o.id, dim.id, restrictions))
      .map((o) => o.id)
  }
  if (dim.kind === 'size') {
    return dim.options
      .filter((o) => o.printEligible)
      .filter((o) => isOptionAllowed(o.id, dim.id, restrictions))
      .map((o) => o.id)
  }
  return []
}

/**
 * Distance between two configs (number of dimensions that differ),
 * weighted so we prefer changing superficial choices over structural
 * ones. Used to pick the shippable config closest to the buyer's
 * current selection when they change country.
 */
function diffCost(a: WizardConfig, b: WizardConfig): number {
  let cost = 0
  const keys = new Set([...Object.keys(a.values), ...Object.keys(b.values)])
  // Heuristic weights — generic across providers. Adapter-specific
  // dimensions just fall through to the default weight.
  const WEIGHT: Record<string, number> = {
    paper: 16,
    printType: 16,
    format: 8,
    frame: 8,
    size: 4,
    mount: 2,
    color: 1,
    frameColor: 1,
    orientation: 1,
  }
  for (const k of keys) {
    if (a.values[k] !== b.values[k]) cost += WEIGHT[k] ?? 5
  }
  return cost
}
