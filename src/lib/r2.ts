import { randomUUID, randomBytes } from 'crypto'

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import prisma from '@/lib/prisma'

// ── R2 client ────────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

// Dedicated bucket for invoice PDFs — must have NO public domain attached.
// Falls back to the main (public) bucket when unset so local dev keeps
// working, but production MUST set R2_PRIVATE_BUCKET_NAME before invoicing
// goes live: on the main bucket the only protection is key secrecy.
const PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET_NAME || BUCKET

// ── Environment prefix ───────────────────────────────────────────────────────

function getEnvPrefix(): string {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'production' : 'staging'
}

// ── Random suffix ────────────────────────────────────────────────────────────

function randomSuffix(): string {
  // CSPRNG, not Math.random(): on the main (public) bucket the object key IS
  // the only access control, so the unguessable suffix must not be derivable
  // from engine state. 12 hex chars ≈ 48 bits.
  return randomBytes(6).toString('hex')
}

// ── Resolve artist handler from userId ───────────────────────────────────────

async function getArtistHandler(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { handler: true },
  })
  // Fallback to userId if handler is not found (shouldn't happen)
  return user?.handler ?? userId
}

// ── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a file to R2.
 * @param key - The full object key (e.g. "production/artist-slug/abc123.webp")
 * @param body - File contents as Buffer
 * @param contentType - MIME type
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return `${PUBLIC_URL}/${key}`
}

// ── Private invoice storage (AR-131) ──────────────────────────────────────────

/**
 * Build a private R2 key for an invoice PDF. The suffix is a cryptographically
 * random UUID (never Math.random — its state is recoverable from the public
 * asset keys minted by the same process). The key is stored on the Invoice row
 * and the PDF is only ever served through the admin-guarded download route.
 */
export function buildInvoiceKey(orderId: string, number: string): string {
  return `${getEnvPrefix()}/invoices/${orderId}/${number}-${randomUUID()}.pdf`
}

/**
 * Upload a private object to the private bucket. Returns nothing — the
 * caller stores the `key`, never a public URL. Used for invoice PDFs.
 */
export async function uploadPrivateToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, no-store',
    }),
  )
}

/** True when an object already exists at `key` in the private bucket. Used to
 *  make invoice PDF uploads write-once: an archived document is never
 *  overwritten by a re-send. */
export async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

/** Fetch a private object's bytes as a Buffer (server-side only). */
export async function getR2ObjectBuffer(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }))
  if (!res.Body) throw new Error(`R2 object not found: ${key}`)
  const bytes = await res.Body.transformToByteArray()
  return Buffer.from(bytes)
}

/** Delete a private-bucket object by key. Dev reset tooling only — invoice
 *  PDFs are immutable in normal operation. */
export async function deletePrivateR2Key(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }))
}

// ── URL → key helpers ────────────────────────────────────────────────────────

/**
 * Extract the R2 object key from a public URL by stripping any of the
 * known host prefixes the app has used over time (custom domain,
 * r2.dev development URL, current production domain). Reused by
 * `deleteFromR2` and the reconciliation script.
 *
 * Returns `null` for URLs that can't possibly be R2 (e.g. legacy
 * Vercel Blob storage), so callers can skip them safely.
 */
export function extractR2KeyFromUrl(url: string): string | null {
  if (!url) return null
  if (url.includes('blob.vercel-storage.com')) return null
  const stripped = url
    .replace(`${PUBLIC_URL}/`, '')
    .replace(/^https?:\/\/pub-[a-f0-9]+\.r2\.dev\//, '')
    .replace(/^https?:\/\/assets\.theartroom\.gallery\//, '')
  // If nothing was stripped, the URL wasn't pointing at R2.
  if (stripped === url) return null
  return stripped
}

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a file from R2 by its public URL.
 * Handles multiple URL formats: custom domain, r2.dev, and legacy URLs.
 */
export async function deleteFromR2(url: string): Promise<void> {
  // Skip Vercel Blob URLs — they can't be deleted via R2
  if (url.includes('blob.vercel-storage.com')) {
    console.info('[R2] Skipping Vercel Blob URL (legacy):', url)
    return
  }
  const key = extractR2KeyFromUrl(url) ?? url
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )
}

/**
 * Return the byte size of a main-bucket object by key, or null if it can't be
 * read. Used to verify a client-uploaded object's real size after a presigned
 * PUT (the presigned URL itself imposes no size limit, and the declared
 * fileSize is client-supplied and optional).
 */
export async function getR2ObjectSize(key: string): Promise<number | null> {
  try {
    const res = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return typeof res.ContentLength === 'number' ? res.ContentLength : null
  } catch {
    return null
  }
}

/**
 * Delete a single R2 object by its key (no URL parsing). Used by
 * maintenance scripts that already have raw keys from a list call.
 */
export async function deleteR2KeyDirect(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )
}

// ── List ─────────────────────────────────────────────────────────────────────

/**
 * List every object key in the R2 bucket, optionally filtered by
 * prefix. Pages through results so callers don't have to. Intended
 * for maintenance scripts (orphan reconciliation, audits) — too
 * expensive for request-path use on large buckets.
 */
export async function listAllR2Keys(prefix?: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return keys
}

// ── Presigned URL (for client-side uploads) ──────────────────────────────────

/**
 * Generate a presigned PUT URL for direct client-to-R2 uploads.
 * Used for large files (videos) that exceed Vercel's serverless body limit.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

// ── Key builders ─────────────────────────────────────────────────────────────
// These build the R2 object key for each asset type.
// Structure: {env}/{artist-handler}/{artworkId}-{suffix}.{ext}

export async function buildArtworkImageKey(userId: string, artworkId: string): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/artists/${handler}/${artworkId}-${randomSuffix()}.webp`
}

export async function buildOriginalImageKey(
  userId: string,
  artworkId: string,
  ext: string,
): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `artworks-original/${getEnvPrefix()}/${handler}/${artworkId}-${randomSuffix()}.${ext}`
}

export async function buildArtworkMediaKey(
  userId: string,
  artworkId: string,
  ext: string,
): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/artists/${handler}/${artworkId}-${randomSuffix()}.${ext}`
}

// Aliases — kept for call-site clarity (video vs sound context)
export const buildArtworkVideoKey = buildArtworkMediaKey
export const buildArtworkSoundKey = buildArtworkMediaKey

export async function buildProfileImageKey(userId: string): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/profiles/${handler}/avatar-${randomSuffix()}.webp`
}

// Artist signature stored as a transparent PNG alongside the profile
// image. Supplied to theprintspace for signed limited-edition prints.
export async function buildSignatureImageKey(userId: string): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/profiles/${handler}/signature-${randomSuffix()}.png`
}

export async function buildExhibitionImageKey(exhibitionId: string): Promise<string> {
  // Look up exhibition URL slug for a readable path
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { url: true },
  })
  const slug = exhibition?.url ?? exhibitionId
  return `${getEnvPrefix()}/exhibitions/${slug}/featured-${randomSuffix()}.webp`
}

export async function buildSlideImageKey(slideId: string): Promise<string> {
  return `${getEnvPrefix()}/slides/${slideId}/image-${randomSuffix()}.webp`
}

// Banner image for a CMS PageContent row (currently only /prints).
export function buildPageBannerImageKey(slug: string): string {
  return `${getEnvPrefix()}/pages/${slug}/banner-${randomSuffix()}.webp`
}
