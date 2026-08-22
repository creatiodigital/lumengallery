import { test, expect } from '@playwright/test'

import { vatLabel } from '../src/lib/checkout/vatLabel'
import { getVatRate } from '../src/lib/print-providers/printspace/pricing'

/**
 * The checkout's VAT row names the rate it applied. Buyers should not have to
 * divide the tax out of the total to see what they were charged, and on an
 * export sale a bare "VAT €0.00" reads like an omission rather than the
 * deliberate zero-rating it is.
 */

test('a home sale names the Spanish rate', () => {
  expect(vatLabel(getVatRate('ES'))).toBe('VAT (21%)')
})

test('another EU country is charged the same rate, pre-OSS', () => {
  expect(vatLabel(getVatRate('DE'))).toBe('VAT (21%)')
})

// The zero is a decision (export, outside the EU), so it is stated rather than
// left as an unexplained blank line.
test('an export sale names the zero rate', () => {
  expect(vatLabel(getVatRate('US'))).toBe('VAT (0%)')
})

// Taken from the authoritative rate, never divided back out of two rounded
// money figures — that lands on 20% or 22% at the edges.
test('a fractional rate is stated to one decimal, not rounded away', () => {
  expect(vatLabel(0.075)).toBe('VAT (7.5%)')
})
