import { test, expect } from '@playwright/test'
import { formatInvoiceNumber, seriesFor } from '../src/lib/invoices/invoiceNumber'

test('formats AR-MM-YYYY-NNN with zero padding', () => {
  expect(formatInvoiceNumber('AR', 2026, 6, 1)).toBe('AR-06-2026-001')
  expect(formatInvoiceNumber('AR', 2026, 6, 42)).toBe('AR-06-2026-042')
  expect(formatInvoiceNumber('AR', 2026, 12, 7)).toBe('AR-12-2026-007')
})

test('credit-note series', () => {
  expect(seriesFor('credit_note')).toBe('AR-R')
  expect(seriesFor('invoice')).toBe('AR')
  expect(formatInvoiceNumber('AR-R', 2026, 7, 3)).toBe('AR-R-07-2026-003')
})
