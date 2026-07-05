import { test, expect } from '@playwright/test'
import {
  uploadPrivateToR2,
  getR2ObjectBuffer,
  deleteR2KeyDirect,
} from '../src/lib/r2'

// Integration: private invoice PDFs must round-trip through R2 (upload →
// fetch bytes) so the admin-guarded download route can serve them. Self-cleaning.
test('private R2 upload → fetch round-trips, then delete', async () => {
  const key = `staging/test/invoice-helper-${Date.now()}.pdf`
  const body = Buffer.from('%PDF-1.7 the-art-room invoice helper test')
  await uploadPrivateToR2(key, body, 'application/pdf')
  const back = await getR2ObjectBuffer(key)
  expect(back.equals(body)).toBe(true)
  await deleteR2KeyDirect(key)
})
