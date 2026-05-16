/**
 * Public surface of the provider abstraction.
 *
 * Wizard imports: types, formatters, the client-side availability
 * dispatcher. The wizard NEVER imports from this index from a server
 * module — server-only entry points (loadCatalog, quote) live in their
 * own files with their own `'use server'` directives.
 */
export type {
  AvailabilityCheck,
  BorderDimension,
  Catalog,
  DeliveryEstimate,
  Dimension,
  DimensionBase,
  EnumDimension,
  GetQuoteInput,
  LoadCatalogInput,
  Option,
  PrintProvider,
  PrintRecommendations,
  PrintRestrictions,
  ProviderId,
  Quote,
  QuoteLine,
  SizeDimension,
  SizeOption,
  VisualHints,
  WizardConfig,
} from './types'

export { formatDualDimensions, formatEuro } from './format'

export { buildAvailability } from './availability'
export { estimateDelivery, formatDeliveryEstimate } from './delivery'

export {
  buildInitialConfig,
  clampCm,
  collectVisualHints,
  configShipsTo,
  dimensionAllowList,
  findBorderDimension,
  findEnumDimension,
  findShippableConfig,
  findSizeDimension,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
  isDimensionVisible,
  isOptionAllowed,
  isOptionPickable,
  isOptionVisible,
} from './configHelpers'

export type { FilterContext } from './configHelpers'

export { summarizeConfig } from './specs'
export type { SpecsSummary } from './specs'

export { findConfigRestrictionClash } from './checkConfigRestrictions'
export type { RestrictionClash } from './checkConfigRestrictions'
