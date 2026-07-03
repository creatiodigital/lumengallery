import { test, expect } from '@playwright/test'
import { renderInvoiceEmail } from '../src/lib/emails/invoice'

test('invoice email names the number and the buyer', () => {
  const { subject, html } = renderInvoiceEmail({
    buyerName: 'Jane Doe',
    number: 'AR-06-2026-001',
    isCreditNote: false,
  })
  expect(subject).toBe('Your invoice from The Art Room')
  expect(html).toContain('AR-06-2026-001')
  expect(html).toContain('Jane')
  expect(html).toContain('invoice')
})

test('credit-note email uses credit-note wording', () => {
  const { subject, html } = renderInvoiceEmail({
    buyerName: 'Jane Doe',
    number: 'AR-R-06-2026-001',
    isCreditNote: true,
  })
  expect(subject).toBe('Your credit note from The Art Room')
  expect(html).toContain('credit note')
})
