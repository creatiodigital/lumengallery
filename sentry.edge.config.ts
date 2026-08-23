import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tag events with the running deployment's build (edge runtime).
  initialScope: {
    tags: { client_build: process.env.NEXT_PUBLIC_BUILD_ID || 'dev' },
  },

  // Trace sampling: 10%, not 100%. Traces are billed as Vercel Active CPU on
  // every request (span creation, serialisation, envelope build) and burn Sentry
  // quota, and nobody reads 100% of them. Error capture is UNAFFECTED — errors
  // are always sent. NB: keep this in step across client/server/edge. Sentry
  // inherits an incoming trace's sampling decision ("if you're using a
  // tracesSampleRate rather than a tracesSampler, the decision will always be
  // inherited"), so a client left at 1.0 would drag the server back to 100%
  // for every browser-initiated request.
  tracesSampleRate: 0.1,

  // Enable logging
  enableLogs: true,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',
})
