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
 */
const reported = new Set<string>()

type ImageErrorContext = {
  /** Where it failed, e.g. 'exhibition-grid', 'artwork-detail', 'lightbox'. */
  surface?: string
  /** Alt text — helps identify which artwork in the Sentry event. */
  alt?: string
}

export function reportImageError(
  src: string | null | undefined,
  context: ImageErrorContext = {},
): void {
  if (!src) return
  if (reported.has(src)) return
  reported.add(src)

  try {
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
  } catch {
    // Observability must never break rendering.
  }
}
