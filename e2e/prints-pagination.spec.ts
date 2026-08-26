import { test, expect } from '@playwright/test'

import { getPrintsCatalogPage } from '@/app/prints/actions'

/**
 * The catalogue query outlived the catalogue page: it now feeds the admin
 * picker (see gallery-selection). Paging still has to be right, because the
 * picker pages through it.
 */
test('the catalogue action pages and reports a total', async () => {
  const { items, totalCount } = await getPrintsCatalogPage({ page: 1 })
  expect(totalCount).toBeGreaterThanOrEqual(items.length)
  expect(items.length).toBeLessThanOrEqual(24)
})

test('the edition filter narrows the action server-side', async () => {
  const all = await getPrintsCatalogPage({ page: 1 })
  const limited = await getPrintsCatalogPage({ page: 1, edition: 'limited' })
  expect(limited.totalCount).toBeLessThanOrEqual(all.totalCount)
  expect(limited.items.every((i) => i.editionType === 'limited')).toBe(true)
})
