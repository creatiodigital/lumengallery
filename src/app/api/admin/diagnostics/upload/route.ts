import v8 from 'node:v8'
import os from 'node:os'

import { NextResponse } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { getR2ObjectSize } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/admin/diagnostics/upload — what the deployment can actually do.
 *
 * Born from the 2026-08-25 outage: artwork uploads returned 504
 * FUNCTION_INVOCATION_TIMEOUT in production while the identical image processed
 * in ~1.9 s locally against the same R2 bucket. Every fact needed to explain
 * that gap lived inside the function and was invisible from outside, so the
 * diagnosis had to be reasoned rather than read. This endpoint reads it.
 *
 * The CPU yardstick is the important part. It runs the SAME encode the upload
 * pipeline runs — 2048², WebP, effort 2 — so the number is directly comparable
 * to a local run. That ratio is what distinguishes "this function is simply
 * slower, raise the budget" from "something is stuck", which no amount of
 * staring at a 504 will tell you.
 *
 * Deliberately reports shape and timings only: no credentials, no bucket
 * contents, no customer data.
 */
export async function GET() {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024)

  // ── CPU yardstick ─────────────────────────────────────────────────────────
  // Same dimensions and encoder settings as processImage, so the figure can be
  // compared like for like against a developer machine.
  let cpu: { webpEncodeMs: number | null; error?: string } = { webpEncodeMs: null }
  try {
    const sharpMod = (await import('sharp')).default
    const side = 2048
    const raw = Buffer.allocUnsafe(side * side * 3)
    // Deterministic, non-uniform fill: a flat colour would compress to almost
    // nothing and measure the wrong thing.
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251

    const started = Date.now()
    await sharpMod(raw, { raw: { width: side, height: side, channels: 3 } })
      .webp({ quality: 85, effort: 2 })
      .toBuffer()
    cpu = { webpEncodeMs: Date.now() - started }
  } catch (err) {
    cpu = { webpEncodeMs: null, error: err instanceof Error ? err.name : 'encode failed' }
  }

  // ── R2 reachability from INSIDE the deployment ────────────────────────────
  // Local reachability proves nothing about the function's egress path, which
  // is exactly the confusion this outage produced.
  let r2: { headObjectMs?: number; reachable: boolean; error?: string }
  try {
    const started = Date.now()
    // A key that will not exist: HeadObject still exercises DNS, TLS, auth and
    // the round trip, and a "not found" is a successful conversation.
    await getR2ObjectSize('diagnostics/does-not-exist.jpg')
    r2 = { reachable: true, headObjectMs: Date.now() - started }
  } catch (err) {
    r2 = { reachable: false, error: err instanceof Error ? err.name : 'unknown' }
  }

  let sharpVersion = 'unavailable'
  let libvipsVersion = 'unavailable'
  try {
    const sharpMod = (await import('sharp')).default as unknown as {
      versions: Record<string, string>
    }
    sharpVersion = sharpMod.versions?.sharp ?? 'unknown'
    libvipsVersion = sharpMod.versions?.vips ?? 'unknown'
  } catch {
    // Leave the defaults — an unloadable sharp is itself the answer.
  }

  const heap = v8.getHeapStatistics()

  return NextResponse.json({
    runtime: {
      node: process.version,
      sharp: sharpVersion,
      libvips: libvipsVersion,
      // Short, non-identifying deployment facts only.
      region: process.env.VERCEL_REGION ?? 'local',
      env: process.env.NEXT_PUBLIC_APP_ENV ?? 'unknown',
    },
    memory: {
      heapLimitMb: mb(heap.heap_size_limit),
      heapUsedMb: mb(heap.used_heap_size),
      rssMb: mb(process.memoryUsage().rss),
      systemTotalMb: mb(os.totalmem()),
      // A 6000×6000 image decodes to roughly this much raw bitmap. If it is a
      // large fraction of heapLimitMb, the function is thrashing rather than
      // merely running slowly, and more time will not save it.
      rawBitmapMbFor36Mp: mb(6000 * 6000 * 3),
    },
    cpu: {
      ...cpu,
      cores: os.cpus().length,
      // Measured on a developer machine for the identical encode, as the
      // reference point. Roughly 250 ms; several times that here means the
      // function is CPU-starved.
      localReferenceMs: 250,
    },
    r2,
  })
}
