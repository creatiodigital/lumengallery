import { test, expect } from '@playwright/test'

import { buildAvailability } from '@/lib/print-providers/availability'
import { configShipsTo } from '@/lib/print-providers/configHelpers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import type { WizardConfig } from '@/lib/print-providers/types'

/**
 * A blank option must never be free.
 *
 * `getPrintspaceQuote` computed the frame charge as
 * `isFramed && frameTypeId ? getFrameSupplementCents(...) : 0`. An EMPTY STRING
 * is falsy, so the supplement collapsed to zero while `format` stayed
 * `'framing'` — a framed order, with a moulding named on it, priced as if it
 * were unframed. `glass` had the same hole from a different direction:
 * `?? 'none'` catches null and undefined but not `''`.
 *
 * Every guard in front let it through. The shape validator required only a
 * string; the restriction check skipped falsy values outright; and `configShipsTo`
 * rejected only `undefined`, then delegated to an availability function that
 * returns true. Measured on the real pricing library, a 60×90 framed order to
 * Spain dropped from 97163 to 48763 cents, and the worst case waived €955.90 on
 * a single order.
 *
 * The order record stayed fully consistent — every row present, one line silently
 * absent — so there was no tell when placing it with the lab by hand.
 *
 * Fixed in `configShipsTo`, which both money paths already call: a dimension's
 * value must be a non-empty id that the catalog actually offers. Limited
 * editions were never exposed (the server rebuilds their config from the
 * published variant and discards the client's).
 */

const FIXTURE_PX = { imageWidthPx: 6000, imageHeightPx: 4000 }
const COUNTRY = 'ES'

async function framedSetup() {
  const catalog = await loadProviderCatalog('printspace', FIXTURE_PX)
  const availability = buildAvailability(catalog)

  const dim = (id: string) => catalog.dimensions.find((d) => d.id === id)
  const format = dim('format')
  const frameType = dim('frameType')
  test.skip(!format || !frameType, 'catalog has no framing dimensions')

  // Build a genuinely framed config from the catalog's own option ids, so the
  // baseline is something the real wizard could have produced.
  const values: Record<string, string> = {}
  for (const d of catalog.dimensions) {
    const first = d.options?.[0]?.id
    if (first) values[d.id] = first
  }
  values.format = 'framing'
  values.frameType = frameType!.options[0].id

  const config = { values, customSize: { widthCm: 60, heightCm: 90 } } as unknown as WizardConfig
  return { catalog, availability, config }
}

test('a framed config with a real frame type is accepted — the positive control', async () => {
  const { catalog, availability, config } = await framedSetup()

  expect(
    configShipsTo(catalog, config, COUNTRY, availability),
    'a valid framed config must still be purchasable',
  ).toBe(true)
})

test('a blank frame type is rejected instead of being priced at zero', async () => {
  const { catalog, availability, config } = await framedSetup()

  const tampered = {
    ...config,
    values: { ...config.values, frameType: '' },
  } as unknown as WizardConfig

  expect(
    configShipsTo(catalog, tampered, COUNTRY, availability),
    'an empty frameType must not pass validation',
  ).toBe(false)
})

test('a blank glass option is rejected too', async () => {
  const { catalog, availability, config } = await framedSetup()
  test.skip(!catalog.dimensions.some((d) => d.id === 'glass'), 'catalog has no glass dimension')

  const tampered = {
    ...config,
    values: { ...config.values, glass: '' },
  } as unknown as WizardConfig

  expect(configShipsTo(catalog, tampered, COUNTRY, availability)).toBe(false)
})

test('an option id the catalog does not offer is rejected', async () => {
  const { catalog, availability, config } = await framedSetup()

  // The other half of the same bug: a NON-EMPTY bogus id reached `pickTier` and
  // threw `tiers is not iterable`, which surfaced as an unhandled 500 in the
  // payment action because the quote call sits outside its try/catch.
  const tampered = {
    ...config,
    values: { ...config.values, frameType: 'not-a-real-frame' },
  } as unknown as WizardConfig

  expect(configShipsTo(catalog, tampered, COUNTRY, availability)).toBe(false)
})
