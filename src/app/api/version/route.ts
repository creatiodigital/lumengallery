import { NextResponse } from 'next/server'

/**
 * Returns the build of the deployment currently serving requests. The client
 * (VersionGuard) compares this against the build its tab booted to detect users
 * stuck on a stale/cached version. Must never be cached.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const build = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

  return NextResponse.json({ build }, { headers: { 'Cache-Control': 'no-store' } })
}
