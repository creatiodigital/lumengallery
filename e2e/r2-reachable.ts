import net from 'node:net'

/**
 * Is the R2 S3 API reachable from this machine right now?
 *
 * Spanish ISPs periodically null-route whole Cloudflare IP ranges under the
 * LaLiga anti-piracy blocking orders — during match hours the 172.64.x.x range
 * that `*.r2.cloudflarestorage.com` resolves to simply stops accepting TCP.
 * DNS still resolves, the R2 custom domain on a different range keeps serving
 * files, and production is untouched because Vercel talks to R2 from its own
 * network. Only this laptop is cut off.
 *
 * The three specs that call the S3 API then fail with
 *
 *     TimeoutError: @smithy/node-http-handler - the request socket did not
 *     establish a connection with the server within the configured timeout
 *
 * which is not a regression but still fails the pre-push hook and blocks a
 * push. Commenting those tests out would fix tonight and be forgotten by
 * Tuesday, so instead they skip themselves ONLY while the block is active and
 * come back automatically the moment it lifts — no state, nothing to undo.
 *
 * A skip is loud (Playwright prints it with this reason) where a commented-out
 * test is silent, which is the whole reason to prefer one over the other.
 *
 * Raw TCP rather than an HTTP client: we are asking whether the socket opens
 * at all, which is precisely what the block prevents, and it costs no
 * dependency and no credentials.
 */
const HOST = 'r2.cloudflarestorage.com'
const PORT = 443
const TIMEOUT_MS = 3000

let cached: Promise<boolean> | null = null

function probe(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(TIMEOUT_MS)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(PORT, HOST)
  })
}

/** Cached per worker — one probe per run, not one per test. */
export function r2Reachable(): Promise<boolean> {
  if (!cached) cached = probe()
  return cached
}

export const R2_BLOCKED_REASON =
  'R2 S3 API unreachable from this network (Cloudflare IP range blocked — see e2e/r2-reachable.ts). ' +
  'Production is unaffected; re-run when the block lifts.'
