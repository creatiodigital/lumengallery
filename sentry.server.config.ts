import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tag events with the running deployment's build (server side).
  initialScope: {
    tags: { client_build: process.env.NEXT_PUBLIC_BUILD_ID || 'dev' },
  },

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Enable logging
  enableLogs: true,

  // Console logging integration
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',
})
