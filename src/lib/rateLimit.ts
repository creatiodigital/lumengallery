import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'

/**
 * Durable, cross-instance rate limiting backed by Postgres (the `RateLimit`
 * table in our own database — no external service).
 *
 * A single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` increments a
 * fixed-window counter per key, so limits are shared across every serverless
 * instance and survive redeploys — unlike a module-level Map, which is
 * per-instance and resets on each deploy. The statement is atomic, so
 * concurrent requests can't race past the limit.
 *
 * Fixed-window (not sliding): trivially atomic in one statement. The only
 * imprecision is a possible ~2x burst right at a window boundary, which is fine
 * for these security limits — they're set with margin.
 *
 * Fails OPEN on any DB error: a limiter must never lock every user out because
 * of a transient database blip. Failures are logged for visibility.
 */

export type RateLimitResult = { success: boolean; remaining: number }

export async function rateLimit(opts: {
  name: string
  key: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  const { name, key, limit, windowSeconds } = opts
  const storeKey = `${name}:${key}`
  // Bound the stored key length (defence against a pathological key).
  const boundedKey = storeKey.length > 200 ? storeKey.slice(0, 200) : storeKey
  const interval = `${Math.max(1, Math.floor(windowSeconds))} seconds`

  try {
    // now() throughout so all comparisons use the DB clock (no app/DB skew).
    // On conflict: reset to 1 if the window has lapsed, else increment.
    const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      INSERT INTO "RateLimit" ("key", "count", "windowEnd", "updatedAt")
      VALUES (${boundedKey}, 1, now() + ${interval}::interval, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowEnd" < now() THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "windowEnd" = CASE
          WHEN "RateLimit"."windowEnd" < now() THEN now() + ${interval}::interval
          ELSE "RateLimit"."windowEnd"
        END,
        "updatedAt" = now()
      RETURNING "count";
    `)
    const count = rows[0]?.count ?? 1
    return { success: count <= limit, remaining: Math.max(0, limit - count) }
  } catch (err) {
    console.error(`[rateLimit] DB error on "${name}", failing open:`, err)
    return { success: true, remaining: limit }
  }
}

/**
 * Delete counter rows whose window has already lapsed. Keeps the table from
 * accumulating one-off keys (transient IPs / sessions). Called periodically
 * from the reconcile cron; best-effort, never throws.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const { count } = await prisma.rateLimit.deleteMany({
      where: { windowEnd: { lt: new Date() } },
    })
    return count
  } catch (err) {
    console.error('[rateLimit] cleanup failed:', err)
    return 0
  }
}
