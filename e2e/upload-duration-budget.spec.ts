import fs from 'node:fs'
import path from 'node:path'

import { test, expect } from '@playwright/test'

/**
 * Every route that does heavy work must declare its own `maxDuration`.
 *
 * 2026-08-25: uploading an 8.9 MB / 6000×6000 JPEG to production returned
 * 504 FUNCTION_INVOCATION_TIMEOUT, twice, ten minutes apart. The identical file
 * processed in ~1.9 s locally against the same R2 bucket; R2 was healthy on both
 * the S3 API endpoint and the public CDN; and the upload code was byte-identical
 * to the previous release. So neither storage nor a regression explained it.
 *
 * The gap was an absent budget: `maxDuration` appeared NOWHERE in the repo and
 * `vercel.json` carries only a `crons` array, so these routes ran at Vercel's
 * low platform default while decoding 36 megapixels and running four WebP
 * encodes on a shared vCPU.
 *
 * The cost scales with MEGAPIXELS, not file bytes — JPEG decode uses
 * shrink-on-load — which is why a 160 MB TIFF of modest dimensions had gone
 * through fine two days earlier. That mismatch is what made the failure look
 * inexplicable, and it is why this guard is worth having.
 *
 * Asserted against the SOURCE rather than an imported module, deliberately:
 * `maxDuration` is a build-time config export that Next.js extracts by static
 * analysis, so the source is the same thing Next.js reads. (The route also
 * cannot be imported into Playwright's CJS context at all.)
 */

const ROUTES = [
  'src/app/api/upload/image/route.ts',
  'src/app/api/upload/video/route.ts',
] as const

/** Matches the statically-analyzable form Next.js requires. */
const MAX_DURATION_RE = /^export const maxDuration\s*=\s*(\d+)$/m

for (const route of ROUTES) {
  test(`${route} declares a duration budget`, async () => {
    const source = fs.readFileSync(path.join(process.cwd(), route), 'utf8')
    const match = source.match(MAX_DURATION_RE)

    expect(
      match,
      `${route} must export a literal maxDuration — without it Vercel applies its low platform default and a large upload 504s`,
    ).not.toBeNull()

    // Measured at ~1.9 s of real work locally; Vercel's shared vCPU plus a cold
    // load of sharp's native bindings runs several times slower. 60 s is
    // generous for a route an artist triggers by hand, and is also the ceiling
    // on Vercel's lowest plan — so it is valid regardless of plan.
    expect(Number(match![1])).toBeGreaterThanOrEqual(60)
  })
}
