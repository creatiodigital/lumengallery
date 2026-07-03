// TEMP read-only diagnostic: recent Stripe (test-mode) PaymentIntents.
import { stripe } from '@/lib/stripe/client'

async function main() {
  const pis = await stripe.paymentIntents.list({ limit: 6 })
  console.log('=== RECENT PAYMENT INTENTS (test mode) ===')
  for (const pi of pis.data) {
    console.log(
      JSON.stringify(
        {
          id: pi.id,
          status: pi.status,
          capture_method: pi.capture_method,
          amount: pi.amount,
          currency: pi.currency,
          created: new Date(pi.created * 1000).toISOString(),
          kind: pi.metadata?.kind ?? '(none)',
          metadataKeys: Object.keys(pi.metadata ?? {}),
        },
        null,
        2,
      ),
    )
  }
}

main().catch((e) => console.error(e))
