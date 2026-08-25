import { test, expect } from '@playwright/test'

/**
 * The probe that would have answered the 2026-08-25 upload outage in a minute.
 *
 * That incident cost an evening because the only observable was a 504 with a
 * generic body. Everything that actually mattered — how fast the function's CPU
 * is, how much memory it has, whether R2 answers from inside Vercel, which
 * region it ran in, what libvips build sharp loaded — was invisible from
 * outside, and none of it could be inferred from a local machine where the same
 * image processed in 1.9 s.
 *
 * So this endpoint measures those things FROM INSIDE the deployment and reports
 * them. It runs a small fixed WebP encode as a CPU yardstick: comparing that
 * number against the same encode locally converts "Vercel feels slower" into a
 * ratio, which is what tells you whether a duration budget is the fix or whether
 * something is genuinely stuck.
 *
 * It is superAdmin-only. It reports infrastructure shape and timings, and must
 * never disclose credentials, bucket contents, or customer data.
 */

test.describe('unauthenticated', () => {
  test('the probe is not reachable without a session', async ({ request }) => {
    const res = await request.get('/api/admin/diagnostics/upload')
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('as an artist', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test('an ordinary artist cannot read deployment internals', async ({ request }) => {
    const res = await request.get('/api/admin/diagnostics/upload')
    expect(res.status()).toBe(403)
  })
})

test.describe('as an admin', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('the probe reports the numbers the outage needed', async ({ request }) => {
    const res = await request.get('/api/admin/diagnostics/upload')
    expect(res.ok(), `probe failed: ${res.status()}`).toBe(true)

    const body = await res.json()

    // Where it ran and what it is running on.
    expect(body.runtime).toBeTruthy()
    expect(typeof body.runtime.node).toBe('string')
    expect(typeof body.runtime.sharp).toBe('string')
    expect(typeof body.runtime.libvips).toBe('string')

    // Memory headroom — a 36 MP image decodes to ~108 MB of raw bitmap, so a
    // constrained function thrashes rather than simply running slowly.
    expect(typeof body.memory.heapLimitMb).toBe('number')

    // The CPU yardstick. Compare against the same encode locally to get a ratio.
    expect(typeof body.cpu.webpEncodeMs).toBe('number')
    expect(body.cpu.webpEncodeMs).toBeGreaterThan(0)

    // Does R2 answer from inside the deployment? Local reachability proves
    // nothing about the function's egress path.
    expect(typeof body.r2.headObjectMs === 'number' || typeof body.r2.error === 'string').toBe(true)

    // Never leak the things that would make this endpoint a liability.
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('SECRET')
    expect(raw).not.toMatch(/[A-Za-z0-9]{32,}/)
  })
})
