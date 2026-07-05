'use client'

import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/Button'

/**
 * Logout component — signs out, VERIFIES the session is really gone, then
 * redirects to the home page.
 *
 * The verify-and-retry loop is load-bearing: Auth.js re-issues the JWT
 * session cookie on /api/auth/session reads (sliding expiration), so a
 * session fetch already in flight when the signout POST clears the cookie
 * can respond a moment later with a rotated Set-Cookie — silently
 * resurrecting the session the user just ended. Re-checking after signout
 * (and signing out again if needed) always lands after those stragglers.
 */
const Logout = () => {
  const handleLogout = async () => {
    await signOut({ redirect: false })
    // Wait out the stragglers BEFORE verifying: page-mount session reads
    // respond ~300-700ms after load, so an immediate check passes and the
    // resurrection lands after it. Each round gives in-flight responses
    // time to settle, re-checks, and signs out again if one revived the
    // cookie. Typical cost: one 400ms round.
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      const session = res.ok ? await res.json() : null
      if (!session?.user) break
      await signOut({ redirect: false })
    }
    window.location.href = '/'
  }

  return <Button variant="secondary" label="Log out" onClick={handleLogout} />
}

export default Logout
