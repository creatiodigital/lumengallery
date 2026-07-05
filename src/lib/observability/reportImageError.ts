import * as Sentry from '@sentry/nextjs'

/**
 * Reports a failed image load to Sentry.
 *
 * Broken images don't throw — a failed `<img>` / next-image load fires the
 * `onError` handler and the browser shows a broken icon, but nothing reaches
 * Sentry. That's exactly how AR-125 (exhibition images broken on first load)
 * produced a totally clean dashboard. Call this from image `onError` handlers
 * so we find out the moment real users hit a missing/failed image.
 *
 * Deduped per URL for the tab's lifetime: a whole failing grid — or one image
 * that re-errors on every re-render — collapses to a single Sentry event
 * instead of a flood. The fingerprint groups all hits of the same URL (across
 * users) into one issue.
 *
 * BURST CLASSIFICATION: failures are buffered briefly before reporting.
 * Several images dying in the same breath is the signature of THIS CLIENT
 * losing the assets host (ad blocker, Opera VPN, DNS filter, dropped Wi-Fi) —
 * not of missing objects — so a burst is reported as ONE info-level
 * `client-connectivity` event instead of N per-URL warnings. An isolated
 * failure keeps the per-URL warning: one URL failing across many users,
 * sustained, is the real-missing-file signature and stays loud. (A true mass
 * deletion still surfaces: every visitor produces a burst event, so the
 * single burst issue spikes across users.) Trade-off: reports lag by the
 * buffer window and are lost if the tab closes within it — acceptable for
 * diagnostics.
 */
const reported = new Set<string>()

type ImageErrorContext = {
  /** Where it failed, e.g. 'exhibition-grid', 'artwork-detail', 'lightbox'. */
  surface?: string
  /** Alt text — helps identify which artwork in the Sentry event. */
  alt?: string
}

type PendingFailure = { src: string; context: ImageErrorContext }

/** Failures within this window are classified together. */
const BURST_WINDOW_MS = 2_500

let pending: PendingFailure[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function reportSingle({ src, context }: PendingFailure): void {
  Sentry.withScope((scope) => {
    scope.setLevel('warning')
    scope.setTag('flow', 'image')
    if (context.surface) scope.setTag('surface', context.surface)
    // One Sentry issue per failing URL, regardless of how many users hit it.
    scope.setFingerprint(['image-load-failed', src])
    scope.setExtra('src', src)
    if (context.alt) scope.setExtra('alt', context.alt)
    Sentry.captureMessage(`Image failed to load: ${src}`, 'warning')
  })
}

function reportBurst(batch: PendingFailure[]): void {
  Sentry.withScope((scope) => {
    scope.setLevel('info')
    scope.setTag('flow', 'image')
    scope.setTag('client-connectivity', 'true')
    // All connectivity bursts group into a single Sentry issue.
    scope.setFingerprint(['image-load-burst'])
    scope.setExtra('failedCount', batch.length)
    scope.setExtra(
      'failures',
      batch.map((f) => ({ src: f.src, surface: f.context.surface, alt: f.context.alt })),
    )
    Sentry.captureMessage(
      `${batch.length} images failed to load within ${BURST_WINDOW_MS}ms — client connectivity, not missing objects`,
      'info',
    )
  })
}

function flush(): void {
  flushTimer = null
  const batch = pending
  pending = []
  if (batch.length === 0) return
  if (batch.length === 1) reportSingle(batch[0])
  else reportBurst(batch)
}

export function reportImageError(
  src: string | null | undefined,
  context: ImageErrorContext = {},
): void {
  if (!src) return
  if (reported.has(src)) return
  reported.add(src)

  try {
    pending.push({ src, context })
    if (!flushTimer) flushTimer = setTimeout(flush, BURST_WINDOW_MS)
  } catch {
    // Observability must never break rendering.
  }
}
