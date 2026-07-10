import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Durable, cross-instance rate limiting.
 *
 * Backed by Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set (production), so limits are shared across every serverless instance
 * and survive redeploys — unlike a module-level Map, which is per-instance and
 * resets on each deploy. When the env vars are absent (local dev, e2e) it falls
 * back to an in-memory sliding window so behaviour is never worse than before
 * and tests aren't throttled.
 *
 * Fails OPEN on any Redis error: a rate limiter must never lock every user out
 * of login because the store had a blip. Failures are logged for visibility.
 */

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = url && token ? new Redis({ url, token }) : null

export const isDurableRateLimitConfigured = redis !== null

export type RateLimitResult = { success: boolean; remaining: number }

// One Ratelimit instance per (name, limit, window) config, reused across calls.
const upstashLimiters = new Map<string, Ratelimit>()

function getUpstashLimiter(name: string, limit: number, windowSeconds: number): Ratelimit | null {
  if (!redis) return null
  const cacheKey = `${name}:${limit}:${windowSeconds}`
  let limiter = upstashLimiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `rl:${name}`,
      analytics: false,
    })
    upstashLimiters.set(cacheKey, limiter)
  }
  return limiter
}

// In-memory fallback store (per-instance).
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function memoryLimit(
  name: string,
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now()
  const storeKey = `${name}:${key}`
  const windowMs = windowSeconds * 1000
  const record = memoryStore.get(storeKey)
  if (!record || now > record.resetAt) {
    memoryStore.set(storeKey, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }
  if (record.count >= limit) {
    return { success: false, remaining: 0 }
  }
  record.count += 1
  return { success: true, remaining: limit - record.count }
}

/**
 * Consume one token for `key` under the named limit. Returns whether the
 * request is allowed. Each distinct `name` is an independent bucket namespace.
 */
export async function rateLimit(opts: {
  name: string
  key: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  const { name, key, limit, windowSeconds } = opts
  const limiter = getUpstashLimiter(name, limit, windowSeconds)
  if (limiter) {
    try {
      const res = await limiter.limit(key)
      return { success: res.success, remaining: res.remaining }
    } catch (err) {
      // Fail open — never lock users out because Redis had a hiccup.
      console.error(`[rateLimit] Upstash error on "${name}", failing open:`, err)
      return { success: true, remaining: limit }
    }
  }
  return memoryLimit(name, key, limit, windowSeconds)
}
