/**
 * The Print Space adapter — implements the canonical PrintProvider
 * contract. Built up incrementally as the user supplies catalog data
 * (papers, frames, sizes, substrates, hangings) and the price tables.
 *
 * The wizard never imports from this folder directly. Page route
 * dispatches via `getProvider('printspace')` (see ../registry / the
 * loadProviderCatalog dispatcher).
 */
import type { LoadCatalogInput, PrintProvider } from '../types'
import { buildPrintspaceAvailability, buildPrintspaceCatalog } from './buildCatalog'
import { estimateTpsDelivery } from './delivery'
import { getPrintspaceQuote } from './getQuote'

export const printspaceProvider: PrintProvider = {
  id: 'printspace',

  async loadCatalog(input: LoadCatalogInput) {
    return buildPrintspaceCatalog(input)
  },

  buildAvailability() {
    return buildPrintspaceAvailability()
  },

  getQuote: getPrintspaceQuote,

  estimateDelivery: estimateTpsDelivery,
}

export { buildPrintspaceAvailability, buildPrintspaceCatalog } from './buildCatalog'
export { getPrintspaceQuote } from './getQuote'
export { loadPrintspaceCatalog } from './loadCatalog'
export * from './data'
export * from './sizeBounds'
