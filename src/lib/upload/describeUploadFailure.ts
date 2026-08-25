/**
 * Turn a failed upload response into something the artist can act on.
 *
 * Written after a production upload failed with 504 FUNCTION_INVOCATION_TIMEOUT
 * and the editor reported "Something went wrong". The message was accurate and
 * worthless: it did not say which of the three upload steps failed, did not
 * carry the status code, and looked identical to an expired session.
 *
 * The mechanism mattered as much as the wording. Callers were doing:
 *
 *     const result = await res.json()      // throws on a text/plain 504 body
 *     if (!res.ok) setError(result.error)  // never reached
 *
 * so a non-JSON error page raised a SyntaxError that landed in a bare `catch`,
 * discarding the status, the phase and the server's own message on the way. Read
 * the body as text and parse defensively — an error path must not be able to
 * throw, or it destroys the evidence it exists to report.
 */

/** Which of the three upload steps failed. */
export type UploadPhase = 'prepare' | 'storage' | 'process'

const PHASE_LABEL: Record<UploadPhase, string> = {
  prepare: 'preparing the upload',
  storage: 'sending the file to storage',
  process: 'processing the image',
}

/** Statuses that mean "we ran out of time", not "the request was wrong". */
const TIMEOUT_STATUSES = new Set([408, 504, 524])

export async function describeUploadFailure(
  response: Response,
  phase: UploadPhase,
): Promise<string> {
  const { status } = response

  // A serverless function killed mid-flight never returns JSON, and the artist's
  // useful next move is to reduce the image, not to retry the same file. Name
  // resolution explicitly: cost here scales with megapixels, not megabytes, so
  // "smaller file" would send them to compress a JPEG that stays 36 MP.
  if (TIMEOUT_STATUSES.has(status)) {
    return (
      'The server took too long processing this image and gave up. ' +
      'This usually means the resolution is very high — try an image with fewer ' +
      'total pixels (for example 4000 × 4000 rather than 6000 × 6000). ' +
      'The file size matters far less than the pixel dimensions.'
    )
  }

  // Read once, as text. Never `.json()` — the whole bug being fixed is that a
  // non-JSON body made the error handler itself throw.
  let body = ''
  try {
    body = await response.text()
  } catch {
    body = ''
  }

  let serverMessage = ''
  try {
    const parsed = JSON.parse(body) as unknown
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      const value = (parsed as { error: unknown }).error
      if (typeof value === 'string' && value.trim()) serverMessage = value.trim()
    }
  } catch {
    // Not JSON — an HTML error page or a plain-text platform message. Expected;
    // the status and phase below still make the failure identifiable.
  }

  if (status === 401) {
    return 'You have been signed out. Sign in again and retry the upload.'
  }

  if (status === 403) {
    return serverMessage || 'You do not have permission to change this artwork.'
  }

  if (status === 413) {
    return serverMessage || 'That file is too large to upload.'
  }

  // Our own routes answer with { error }. When one does, it is already written
  // for this reader and beats anything generic.
  if (serverMessage) return serverMessage

  return `Upload failed while ${PHASE_LABEL[phase]} (HTTP ${status}). Please try again — if it keeps happening, the image may be too large to process.`
}
