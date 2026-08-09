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
 * instead of a flood. Failures are also buffered briefly so several images
 * dying in the same breath (the signature of THIS CLIENT losing the assets
 * host) report as one burst event instead of N per-URL events.
 *
 * PROBE-VERIFIED CLASSIFICATION: before reporting, the failed URL is re-probed
 * from the same client with a CORS HEAD fetch (the assets host serves
 * `access-control-allow-origin: *`, so the real status is readable). The
 * heuristic "burst = connectivity, single = maybe missing" cried wolf in
 * production — headless crawlers with spoofed UAs and Opera's VPN block the
 * assets host, and pages that eagerly load only ONE image (artist avatar; the
 * grid below is lazy) surfaced those as per-URL missing-object warnings for
 * objects that were serving 200. The probe replaces the guess:
 *
 *   - fetch rejects        → this client can't reach the host (ad blocker,
 *                            VPN, DNS filter, dropped Wi-Fi). Info, one
 *                            shared issue.
 *   - HTTP 2xx/3xx         → object exists and is reachable; the <img>
 *                            failure was a client-side render/abort. Info.
 *   - HTTP 404/410         → object genuinely missing. ERROR — definitive,
 *                            and louder than the old unverified warning.
 *   - other status (5xx…)  → server-side trouble. Warning with the status.
 *   - probe timeout        → inconclusive; keep the old warning shape.
 *
 * Trade-offs: reports lag by the buffer window + probe round-trip and are
 * lost if the tab closes within it — acceptable for diagnostics.
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

/** Give slow-but-working networks time to answer before calling it inconclusive. */
const PROBE_TIMEOUT_MS = 5_000

let pending: PendingFailure[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

type ProbeResult = number | 'unreachable' | 'timeout'

/**
 * HEAD-probe a URL from this client. `no-store` bypasses the browser cache so
 * we test the network path, not a stale cache entry; HEAD with no custom
 * headers needs no preflight.
 */
async function probe(src: string): Promise<ProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(src, {
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    return res.status
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'unreachable'
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Tags common to every image report. `webdriver` flags headless automation
 * (the spoofed-UA crawlers that motivated the probe don't always hide it),
 * `online` catches plain offline tabs.
 */
function setCommonTags(scope: Sentry.Scope, probeResult: ProbeResult): void {
  scope.setTag('flow', 'image')
  scope.setTag('probe', String(probeResult))
  if (typeof navigator !== 'undefined') {
    scope.setTag('webdriver', String(Boolean(navigator.webdriver)))
    scope.setTag('online', String(navigator.onLine))
  }
}

function reportSingle({ src, context }: PendingFailure, probeResult: ProbeResult): void {
  Sentry.withScope((scope) => {
    setCommonTags(scope, probeResult)
    if (context.surface) scope.setTag('surface', context.surface)
    scope.setExtra('src', src)
    if (context.alt) scope.setExtra('alt', context.alt)

    if (probeResult === 'unreachable') {
      scope.setLevel('info')
      scope.setTag('client-connectivity', 'true')
      // All can't-reach-the-host clients group into one archivable issue.
      scope.setFingerprint(['image-load-client-unreachable'])
      Sentry.captureMessage(
        'Image failed and assets host is unreachable from this client — ad blocker / VPN / DNS filter, not a missing object',
        'info',
      )
      return
    }

    if (typeof probeResult === 'number' && probeResult < 400) {
      scope.setLevel('info')
      scope.setFingerprint(['image-load-render-failure', src])
      Sentry.captureMessage(
        `Image failed in <img> but probes HTTP ${probeResult} — client-side render/abort, object exists: ${src}`,
        'info',
      )
      return
    }

    if (probeResult === 404 || probeResult === 410) {
      scope.setLevel('error')
      // Same per-URL fingerprint as the historical unverified warnings, so
      // existing Sentry issues keep accruing their (now-confirmed) events.
      scope.setFingerprint(['image-load-failed', src])
      Sentry.captureMessage(`Image missing (HTTP ${probeResult}): ${src}`, 'error')
      return
    }

    // Other statuses (403, 5xx) and inconclusive timeouts: keep the original
    // warning shape and fingerprint.
    scope.setLevel('warning')
    scope.setFingerprint(['image-load-failed', src])
    const suffix = typeof probeResult === 'number' ? ` (HTTP ${probeResult})` : ''
    Sentry.captureMessage(`Image failed to load${suffix}: ${src}`, 'warning')
  })
}

function reportBurst(batch: PendingFailure[], probeResult: ProbeResult): void {
  Sentry.withScope((scope) => {
    setCommonTags(scope, probeResult)
    scope.setExtra('failedCount', batch.length)
    scope.setExtra(
      'failures',
      batch.map((f) => ({ src: f.src, surface: f.context.surface, alt: f.context.alt })),
    )

    if (probeResult === 404 || probeResult === 410) {
      // A burst whose first URL definitively 404s is the mass-deletion
      // signature — the one case the old heuristic could only catch by a
      // human noticing user counts climb.
      scope.setLevel('error')
      scope.setFingerprint(['image-load-burst-missing'])
      Sentry.captureMessage(
        `${batch.length} images failed and probe returned HTTP ${probeResult} — objects may be missing, NOT client connectivity`,
        'error',
      )
      return
    }

    if (typeof probeResult === 'number' && probeResult >= 400) {
      scope.setLevel('warning')
      scope.setFingerprint(['image-load-burst-server-error'])
      Sentry.captureMessage(
        `${batch.length} images failed to load; probe returned HTTP ${probeResult} — assets host trouble`,
        'warning',
      )
      return
    }

    // Unreachable, timeout, or probe-2xx: the client lost (or is throttling)
    // the assets host mid-burst — connectivity, as before.
    scope.setLevel('info')
    scope.setTag('client-connectivity', 'true')
    scope.setFingerprint(['image-load-burst'])
    Sentry.captureMessage(
      `${batch.length} images failed to load within ${BURST_WINDOW_MS}ms — client connectivity, not missing objects`,
      'info',
    )
  })
}

async function classify(batch: PendingFailure[]): Promise<void> {
  const probeResult = await probe(batch[0].src)
  if (batch.length === 1) reportSingle(batch[0], probeResult)
  else reportBurst(batch, probeResult)
}

function flush(): void {
  flushTimer = null
  const batch = pending
  pending = []
  if (batch.length === 0) return
  classify(batch).catch(() => {
    // Observability must never break rendering.
  })
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
