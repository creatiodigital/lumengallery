'use server'

import type { Catalog, LoadCatalogInput } from '../types'
import { buildPrintspaceCatalog } from './buildCatalog'

/**
 * The Print Space catalog is fully static (no API). This wrapper just
 * preserves the abstraction so a future second adapter would slot in
 * call `loadCatalog` uniformly.
 */
export async function loadPrintspaceCatalog(input: LoadCatalogInput): Promise<Catalog> {
  return buildPrintspaceCatalog(input)
}
