import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tag every event with the build the client booted, so we can spot errors
  // coming from users stuck on a stale/cached version (compared to /api/version).
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

  // Console logging integration
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Replay for session recording (errors only)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  // Drop errors whose top frame is Google Analytics / Tag Manager. These are
  // third-party scripts blocked by ad-blockers or failing on flaky networks —
  // unactionable noise, not bugs in our code.
  denyUrls: [/googletagmanager\.com/i, /google-analytics\.com/i],

  // Filter out noise from bots, browser extensions, and unactionable WebGL errors
  beforeSend(event) {
    // Ignore errors from bots/crawlers — they can't run WebGL
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    if (/bot|crawl|spider|Google-Read-Aloud|Googlebot|Bingbot|Slurp/i.test(ua)) {
      return null
    }

    const message = event.exception?.values?.[0]?.value || ''

    // Browser extensions (e.g. Google Translate) manipulating the DOM
    if (
      message.includes('removeChild') ||
      message.includes('insertBefore') ||
      message.includes('The node to be removed is not a child of this node')
    ) {
      return null
    }

    // WebGL context loss on mobile — device GPU limitation, not a code bug
    if (message.includes('getProgramInfoLog') || message.includes('getShaderInfoLog')) {
      return null
    }

    // Google Analytics / gtag noise: ad-blocker blocks, failed script loads,
    // or errors thrown inside Google's own code. denyUrls above catches most,
    // but messages/frames without a clean top URL are filtered here too.
    const gaPattern = /gtag|googletagmanager|google[\s-]?analytics|analytics\.google/i
    if (gaPattern.test(message)) {
      return null
    }
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
    if (
      frames.some((frame) =>
        /googletagmanager\.com|google-analytics\.com/i.test(frame.filename ?? ''),
      )
    ) {
      return null
    }

    return event
  },

  // The console logging integration forwards warn/error logs to Sentry. Drop
  // any that mention Google Analytics so blocked/failed gtag requests don't
  // surface as log noise either.
  beforeSendLog(log) {
    const message = String(log.message ?? '')
    if (/gtag|googletagmanager|google[\s-]?analytics|analytics\.google/i.test(message)) {
      return null
    }
    return log
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
