import Stripe from 'stripe'

/**
 * Server-side Stripe client. The secret key must stay on the server —
 * the publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) is what the
 * browser uses to mount Stripe Elements.
 *
 * API version: we deliberately do NOT pass `apiVersion` — stripe-node
 * pins the version it was built against, so upgrades happen only when
 * the SDK package is bumped (a reviewed, deliberate change).
 */
const secret = process.env.STRIPE_SECRET_KEY
const isPlaceholder = !secret || secret.startsWith('sk_test_REPLACE_ME')

// Gate hard-fail on NEXT_PUBLIC_APP_ENV, not NODE_ENV. Vercel sets
// NODE_ENV=production for both Production and Preview builds, which
// would otherwise crash any preview missing the live secret at module
// evaluation time (during `next build` page-data collection). Same
// reason we key R2 env prefix off NEXT_PUBLIC_APP_ENV — see
// `840400e fix: key R2 env prefix off NEXT_PUBLIC_APP_ENV`.
if (isPlaceholder) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    throw new Error('[stripe] STRIPE_SECRET_KEY is not configured.')
  }
  console.warn(
    '[stripe] STRIPE_SECRET_KEY is missing or still set to the placeholder. Payment actions will fail until you add a real test key from https://dashboard.stripe.com/test/apikeys',
  )
}

export const stripe = new Stripe(secret ?? '', {
  typescript: true,
  appInfo: { name: 'The Art Room', url: 'https://theartroom.gallery' },
  // Bound every Stripe call: the SDK default is 80s, which under a Stripe
  // slowdown parks serverless functions (and their DB connections) for the
  // full window and lets webhook handlers blow past Stripe's ~10s delivery
  // timeout into retry storms. Retries are safe — stripe-node attaches an
  // idempotency key to retried requests automatically.
  timeout: 10_000,
  maxNetworkRetries: 2,
})
