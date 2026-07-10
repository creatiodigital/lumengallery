import { randomUUID } from 'crypto'

import { cookies } from 'next/headers'

/**
 * Cart-session identity for anonymous limited-edition holds (AR-132).
 *
 * A random, httpOnly cookie value that binds every cart hold to the browser
 * that placed it. The server stamps it on the EditionNumber rows; only the
 * owning session may extend/release those holds, and it caps how much stock a
 * single session can freeze. httpOnly so client JS can't read or forge it.
 */
const CART_SESSION_COOKIE = 'cart_session'
const CART_SESSION_MAX_AGE = 60 * 60 * 8 // 8 hours

/** Read the current cart-session id, or null if the browser has no cookie. */
export async function getCartSessionId(): Promise<string | null> {
  const store = await cookies()
  return store.get(CART_SESSION_COOKIE)?.value ?? null
}

/** Read the cart-session id, minting + setting the cookie if absent. */
export async function getOrCreateCartSessionId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(CART_SESSION_COOKIE)?.value
  if (existing) return existing

  const id = randomUUID()
  store.set(CART_SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_SESSION_MAX_AGE,
  })
  return id
}
