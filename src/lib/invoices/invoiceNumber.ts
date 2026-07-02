// Pure invoice-number helpers (AR-131).
// Format: <series>-MM-YYYY-NNN, e.g. AR-06-2026-001. Sequence is zero-padded
// to 3 digits and resets monthly (each (series, year, month) is its own
// correlative, gap-free block). Credit notes use the 'AR-R' series.

export function seriesFor(type: 'invoice' | 'credit_note'): 'AR' | 'AR-R' {
  return type === 'credit_note' ? 'AR-R' : 'AR'
}

export function formatInvoiceNumber(
  series: string,
  year: number,
  month: number,
  seq: number,
): string {
  const mm = String(month).padStart(2, '0')
  const nnn = String(seq).padStart(3, '0')
  return `${series}-${mm}-${year}-${nnn}`
}
