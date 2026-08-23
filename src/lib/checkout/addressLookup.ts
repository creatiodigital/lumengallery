/**
 * Address autocomplete, over OUR server rather than Google's script.
 *
 * The obvious implementation puts a NEXT_PUBLIC_ Maps key in the page and calls
 * Google from the browser. Every such key is readable by anyone who views
 * source, and the usual defence — HTTP referrer restrictions — is enforced by
 * the BROWSER. A server-side caller forges the header in one line:
 *
 *     curl -H "Referer: https://theartroom.gallery" https://maps.googleapis.com/...
 *
 * So referrer restrictions stop casual reuse on someone else's website and do
 * nothing about deliberate abuse. Since the bill lands on us either way, the
 * key stays on the server and the browser talks only to us. That also means:
 *
 *   - our own per-IP rate limit, on the same durable Postgres limiter that
 *     guards login (a stolen endpoint is throttled; a stolen key is not)
 *   - a hard daily ceiling we choose, so the free tier cannot be blown through
 *     overnight by someone hammering the route
 *   - no third-party script in the buyer's browser at all, which keeps Google
 *     out of the page for anyone who never touches the address field
 *   - nothing to add to a Content-Security-Policy later
 *
 * This module is the client half: plain fetch calls to our own route.
 */
import type { MappedAddress } from './placeToAddress'

export type AddressSuggestion = {
  placeId: string
  /** The bold "Calle de Serrano 21" part. */
  primary: string
  /** The "Madrid, Spain" part. */
  secondary: string
}

/**
 * Why suggestions are unavailable. The UI says something different for each,
 * because "we are rationing this" and "this is switched off" deserve different
 * words — and both deserve better than an empty dropdown that looks broken.
 */
export type LookupFailure = 'disabled' | 'rate_limited' | 'unavailable'

export type SuggestResult =
  | { ok: true; suggestions: AddressSuggestion[] }
  | { ok: false; reason: LookupFailure }

export type DetailsResult =
  | { ok: true; address: MappedAddress }
  | { ok: false; reason: LookupFailure }

const ENDPOINT = '/api/checkout/address-lookup'

/**
 * One billing session spans every keystroke for an address plus the single
 * details call that closes it. It is an opaque string as far as Google is
 * concerned, so the client mints it and passes it to both calls.
 */
export function newSessionToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function post<T>(body: unknown, fallback: T): Promise<T> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok && res.status !== 429) return fallback
    return (await res.json()) as T
  } catch {
    // Offline, aborted, blocked — all the same to the buyer, who should end up
    // typing their address by hand rather than looking at an error.
    return fallback
  }
}

export function fetchAddressSuggestions(
  input: string,
  countryCode: string,
  sessionToken: string,
): Promise<SuggestResult> {
  return post<SuggestResult>(
    { kind: 'suggest', input, countryCode, sessionToken },
    {
      ok: false,
      reason: 'unavailable',
    },
  )
}

export function fetchAddressDetails(placeId: string, sessionToken: string): Promise<DetailsResult> {
  return post<DetailsResult>(
    { kind: 'details', placeId, sessionToken },
    {
      ok: false,
      reason: 'unavailable',
    },
  )
}
