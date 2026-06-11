import * as Sentry from '@sentry/nextjs'

type Flow =
  | 'payment' // Stripe-side money flows: auth, capture, refund, cancel
  | 'order' // Our PrintOrder lifecycle (create, update)
  | 'webhook' // Incoming webhooks from Stripe
  | 'admin' // Admin-initiated actions (refund, payout release)
  | 'email' // Outbound transactional email (Resend)
  | 'upload' // File uploads (artwork images, signatures)
  | 'stripe' // Stripe client calls (paymentIntents.*, transfers.*, refunds.*)
  | 'cron' // Scheduled jobs (reconciliation, etc.)
  | 'content' // Public content reads (exhibition/artwork queries for display)
  | 'image' // Image load failures on display surfaces (client-side)

export type CaptureContext = {
  /** Broad business domain — groups related errors in Sentry filters. */
  flow: Flow
  /** Specific step inside the flow, e.g. 'create-payment-intent', 'capture-failed'. */
  stage: string
  /**
   * Stable keys that identify which business object the error relates to.
   * Surfaces in Sentry's event detail under "Additional Data". Don't put
   * PII here unless you're OK with it living in Sentry for the retention
   * window — for PII use the `pii` field instead so we can scrub later.
   */
  extra?: Record<string, unknown>
  /**
   * Anything you'd want scrubbed before it hits Sentry in strict envs.
   * Today it's merged into `extra`; future-proofing if we tighten PII.
   */
  pii?: Record<string, unknown>
  /**
   * Severity override. Default is 'error'. Use 'warning' for recoverable
   * issues that shouldn't wake anyone up.
   */
  level?: 'error' | 'warning' | 'fatal'
  /**
   * Fingerprint override for manual grouping. Default lets Sentry decide.
   * Use when a class of errors should collapse to a single issue (e.g.
   * every Stripe capture failure for different orders is one issue).
   */
  fingerprint?: string[]
}

/**
 * Server-side error capture with business-flow context. Prefer this over
 * bare `Sentry.captureException(err)` anywhere a payment/order/webhook
 * failure would otherwise go silent to operators. Never throws — logging
 * should never mask the original error.
 */
export function captureError(error: unknown, ctx: CaptureContext): void {
  try {
    Sentry.withScope((scope) => {
      scope.setTag('flow', ctx.flow)
      scope.setTag('stage', ctx.stage)
      if (ctx.level) scope.setLevel(ctx.level)
      if (ctx.fingerprint) scope.setFingerprint(ctx.fingerprint)
      if (ctx.extra) {
        for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v)
      }
      if (ctx.pii) {
        for (const [k, v] of Object.entries(ctx.pii)) scope.setExtra(k, v)
      }
      Sentry.captureException(error)
    })
  } catch (sentryErr) {
    // Sentry itself failed — don't mask the original.
    console.warn('[captureError] Sentry capture threw:', sentryErr)
  }
}
