import { test, expect } from '@playwright/test'

import { describeUploadFailure } from '@/lib/upload/describeUploadFailure'

/**
 * An artist who cannot upload deserves to be told why.
 *
 * On 2026-08-25 a production upload failed with 504 FUNCTION_INVOCATION_TIMEOUT
 * and the editor showed "Something went wrong" — which is true, useless, and
 * indistinguishable from a dozen other failures. It cost an evening of guessing.
 *
 * The mechanism was subtle and worth pinning: the client called `res.json()`
 * BEFORE checking `res.ok`. Vercel's 504 body is `text/plain`, so parsing threw,
 * the throw fell to a bare `catch`, and every distinguishable detail — the
 * status, the phase, the actual server message — was discarded on the way.
 *
 * So the rule this encodes is: read the body defensively, never assume JSON, and
 * always say something the person can act on.
 */

const res = (status: number, body: string, contentType = 'application/json') =>
  new Response(body, { status, headers: { 'content-type': contentType } })

test('a gateway timeout says the server ran out of time, not "something went wrong"', async () => {
  // Exactly what Vercel returns: text/plain, not JSON. Parsing this as JSON is
  // what swallowed the real cause in production.
  const message = await describeUploadFailure(
    res(504, 'An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT', 'text/plain'),
    'process',
  )

  expect(message).toContain('too long')
  expect(message).not.toBe('Something went wrong')
  // The artist's next action is what matters: this image is too big to process.
  expect(message.toLowerCase()).toContain('resolution')
})

test('a JSON error from our own route is shown verbatim', async () => {
  const message = await describeUploadFailure(
    res(400, JSON.stringify({ error: 'File too large. Maximum is 200MB.' })),
    'process',
  )

  expect(message).toBe('File too large. Maximum is 200MB.')
})

test('an expired session is named as one', async () => {
  const message = await describeUploadFailure(
    res(401, JSON.stringify({ error: 'Not authenticated' })),
    'prepare',
  )

  expect(message.toLowerCase()).toContain('signed out')
})

test('a body that is not JSON still produces a specific message, never a parse crash', async () => {
  // The regression that started all this: `.json()` on an HTML error page.
  const message = await describeUploadFailure(
    res(502, '<html><body>Bad Gateway</body></html>', 'text/html'),
    'process',
  )

  expect(message).toContain('502')
  expect(message.length).toBeGreaterThan(20)
})

test('each phase names what was being done, so the failing step is identifiable', async () => {
  const prepare = await describeUploadFailure(res(500, 'x', 'text/plain'), 'prepare')
  const storage = await describeUploadFailure(res(500, 'x', 'text/plain'), 'storage')
  const process_ = await describeUploadFailure(res(500, 'x', 'text/plain'), 'process')

  // Three different failure points must not read identically — that is the
  // whole complaint being fixed.
  expect(new Set([prepare, storage, process_]).size).toBe(3)
  expect(storage.toLowerCase()).toContain('storage')
})
