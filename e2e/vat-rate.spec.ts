import { test, expect } from '@playwright/test'
import { getVatRate } from '../src/lib/print-providers/printspace/pricing'

test('EU buyers pay 21% Spanish VAT', () => {
  for (const c of ['ES', 'DE', 'FR', 'IT', 'NL', 'PT', 'IE']) {
    expect(getVatRate(c)).toBeCloseTo(0.21)
  }
})

test('non-EU buyers pay 0% (export), including UK', () => {
  for (const c of ['US', 'GB', 'CH', 'CA', 'AU', 'JP']) {
    expect(getVatRate(c)).toBe(0)
  }
})

test('empty / unknown country is 0%', () => {
  expect(getVatRate('')).toBe(0)
  expect(getVatRate('ZZ')).toBe(0)
})
