'use server'

/**
 * Provider-agnostic quote dispatcher. The wizard imports this single
 * server action and passes (providerId, input). Internally we route to
 * the right adapter — wizard stays oblivious to who's quoting.
 */
import type { GetQuoteInput, ProviderId, Quote } from './types'
import { getPrintspaceQuote } from './printspace/getQuote'

export async function getProviderQuote(
  providerId: ProviderId,
  input: GetQuoteInput,
): Promise<Quote> {
  switch (providerId) {
    case 'printspace':
      return getPrintspaceQuote(input)
    default:
      throw new Error(`[print-providers] unknown providerId: ${providerId}`)
  }
}
