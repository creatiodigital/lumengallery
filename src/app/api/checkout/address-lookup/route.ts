import { NextRequest, NextResponse } from 'next/server'

import { placeToAddress } from '@/lib/checkout/placeToAddress'
import { getClientIp } from '@/lib/getClientIp'
import { captureError } from '@/lib/observability/captureError'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side proxy for Google Places address autocomplete.
 *
 * The Maps key lives here and never reaches the browser. A NEXT_PUBLIC_ key
 * would be readable by anyone viewing source, and HTTP referrer restrictions —
 * the usual answer — are enforced by the browser and forged in one line of
 * curl. Since the bill arrives either way, the browser talks to us and we talk
 * to Google.
 *
 * That buys three things a public key cannot have: a per-IP rate limit on the
 * same durable limiter that guards login, a hard daily ceiling of our own
 * choosing, and no Google script in the buyer's page at all.
 *
 * NOTHING HERE IS ALLOWED TO BLOCK A SALE. Every failure — no key, throttled,
 * Google down, malformed response — returns a shaped `{ ok: false, reason }`
 * that the address field turns into manual entry with a short explanation.
 */

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const DETAILS_URL = 'https://places.googleapis.com/v1/places'

/** Only the two fields we map. Google bills the highest SKU any requested field
 *  belongs to, and these two are both Essentials — adding one Pro field (say
 *  `displayName`) would move every lookup to the Pro rate. */
const DETAILS_FIELD_MASK = 'addressComponents,formattedAddress'

// Per-IP ceilings. A real buyer debounces into a handful of searches per
// address and exactly one details call, so these are generous for a person and
// tight for a script.
const IP_SUGGEST_LIMIT = 60
const IP_DETAILS_LIMIT = 20
const IP_WINDOW_SECONDS = 600

/**
 * Global daily ceiling on the BILLED call. Google's free tier is 10,000 Place
 * Details (Essentials) per month, which is ~330/day; staying under that means
 * a bad day costs nothing rather than arriving as a surprise invoice. Raise it
 * with ADDRESS_LOOKUP_DAILY_CAP once real volume justifies the spend.
 *
 * Suggestions get a looser cap: they are free within a session, so the limit
 * there is about protecting Google's quota rather than our money.
 */
const DAILY_DETAILS_CAP = Number(process.env.ADDRESS_LOOKUP_DAILY_CAP ?? 300)
const DAILY_SUGGEST_CAP = Number(process.env.ADDRESS_LOOKUP_DAILY_SUGGEST_CAP ?? 5000)
const DAY_SECONDS = 86_400

const MAX_INPUT = 200

type Failure = { ok: false; reason: 'disabled' | 'rate_limited' | 'unavailable' }

const fail = (reason: Failure['reason'], status = 200) =>
  NextResponse.json<Failure>({ ok: false, reason }, { status })

export async function POST(req: NextRequest) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  // Not configured is a normal state, not an error: the form simply offers
  // manual entry, exactly as it did before this feature existed.
  if (!key) return fail('disabled')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('unavailable', 400)
  }

  const kind = body.kind
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : ''
  const ip = getClientIp(req)

  if (kind === 'suggest') {
    const input = typeof body.input === 'string' ? body.input.slice(0, MAX_INPUT) : ''
    const countryCode = typeof body.countryCode === 'string' ? body.countryCode.slice(0, 2) : ''
    if (!input.trim() || !countryCode) return NextResponse.json({ ok: true, suggestions: [] })

    const [perIp, daily] = await Promise.all([
      rateLimit({
        name: 'address-suggest-ip',
        key: ip,
        limit: IP_SUGGEST_LIMIT,
        windowSeconds: IP_WINDOW_SECONDS,
      }),
      rateLimit({
        name: 'address-suggest-daily',
        key: 'global',
        limit: DAILY_SUGGEST_CAP,
        windowSeconds: DAY_SECONDS,
      }),
    ])
    if (!perIp.success || !daily.success) return fail('rate_limited', 429)

    try {
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({
          input,
          // One region code, because the form's country field scopes the
          // search. Google caps this list at 15 and we ship to 38, so
          // "restrict to our whole list" is not expressible in one call.
          includedRegionCodes: [countryCode.toLowerCase()],
          ...(sessionToken ? { sessionToken } : {}),
        }),
      })
      if (!res.ok) {
        // A 4xx here is ours to fix (bad key, API not enabled, quota) and the
        // buyer must never see it — but we should.
        captureError(new Error(`Places autocomplete ${res.status}`), {
          flow: 'checkout',
          stage: 'address-autocomplete',
          level: res.status >= 500 ? 'warning' : 'error',
          fingerprint: ['places:autocomplete', String(res.status)],
        })
        return fail('unavailable')
      }
      const data = (await res.json()) as {
        suggestions?: {
          placePrediction?: {
            placeId?: string
            text?: { text?: string }
            structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
          }
        }[]
      }
      const suggestions = (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .map((p) => ({
          placeId: p.placeId as string,
          primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
          secondary: p.structuredFormat?.secondaryText?.text ?? '',
        }))
      return NextResponse.json({ ok: true, suggestions })
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)), {
        flow: 'checkout',
        stage: 'address-autocomplete',
        level: 'warning',
        fingerprint: ['places:autocomplete-threw'],
      })
      return fail('unavailable')
    }
  }

  if (kind === 'details') {
    const placeId = typeof body.placeId === 'string' ? body.placeId.slice(0, 300) : ''
    if (!placeId) return fail('unavailable', 400)

    const [perIp, daily] = await Promise.all([
      rateLimit({
        name: 'address-details-ip',
        key: ip,
        limit: IP_DETAILS_LIMIT,
        windowSeconds: IP_WINDOW_SECONDS,
      }),
      rateLimit({
        name: 'address-details-daily',
        key: 'global',
        limit: DAILY_DETAILS_CAP,
        windowSeconds: DAY_SECONDS,
      }),
    ])
    if (!perIp.success || !daily.success) return fail('rate_limited', 429)

    try {
      const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`)
      if (sessionToken) url.searchParams.set('sessionToken', sessionToken)
      const res = await fetch(url, {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
      })
      if (!res.ok) {
        captureError(new Error(`Places details ${res.status}`), {
          flow: 'checkout',
          stage: 'address-details',
          level: res.status >= 500 ? 'warning' : 'error',
          fingerprint: ['places:details', String(res.status)],
        })
        return fail('unavailable')
      }
      const data = (await res.json()) as {
        addressComponents?: { types: string[]; longText: string; shortText: string }[]
        formattedAddress?: string
      }
      return NextResponse.json({
        ok: true,
        address: placeToAddress(data.addressComponents ?? [], data.formattedAddress ?? ''),
      })
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)), {
        flow: 'checkout',
        stage: 'address-details',
        level: 'warning',
        fingerprint: ['places:details-threw'],
      })
      return fail('unavailable')
    }
  }

  return fail('unavailable', 400)
}
