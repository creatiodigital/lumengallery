/**
 * Provider-agnostic quote dispatcher. The wizard imports this single
 * function and passes (providerId, input). Internally we route to the
 * right adapter — wizard stays oblivious to who's quoting.
 *
 * Pure math, no DB / fetch / secrets — runs client-side for instant
 * price updates. The payment-intent server action re-runs this exact
 * function as the authoritative price, so a tampered client price
 * never reaches Stripe.
 */
import type { GetQuoteInput, ProviderId, Quote } from './types'
import { getPrintspaceQuote } from './printspace/getQuote'

export function getProviderQuote(providerId: ProviderId, input: GetQuoteInput): Quote {
  switch (providerId) {
    case 'printspace':
      return getPrintspaceQuote(input)
    default:
      throw new Error(`[print-providers] unknown providerId: ${providerId}`)
  }
}
