import type { NextRequest } from 'next/server'

/**
 * Derive the client IP for rate limiting.
 *
 * On Vercel the platform sets `x-real-ip` to the true client IP and appends
 * the real client IP to the END of `x-forwarded-for`. The LEFTMOST
 * `x-forwarded-for` entry is client-supplied and trivially spoofable — an
 * attacker sending a fresh `X-Forwarded-For: <random>` per request would land
 * in a new bucket every time and fully bypass any limiter keyed on it. So we
 * must NOT trust the first hop. Prefer `x-real-ip`; fall back to the LAST
 * `x-forwarded-for` hop (the one the trusted proxy appended); then 'unknown'.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return 'unknown'
}
