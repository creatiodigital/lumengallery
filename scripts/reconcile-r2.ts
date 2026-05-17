/**
 * R2 orphan reconciliation.
 *
 * Lists every object in the R2 bucket, gathers every URL the database
 * currently references, and reports keys that exist in R2 but aren't
 * pointed at by any DB row (orphans). Optionally deletes them.
 *
 * Targets one environment per run — the env is read from
 * NEXT_PUBLIC_APP_ENV (same source the app uses), so you load the
 * env file matching the bucket prefix you want to clean.
 *
 * Run (dry-run — safe, never deletes):
 *   npx dotenv -e .env.local -- npx tsx scripts/reconcile-r2.ts
 *
 * Delete in staging (still asks for typed confirmation):
 *   npx dotenv -e .env.local -- npx tsx scripts/reconcile-r2.ts --delete
 *
 * Delete in production (requires BOTH flags + typed confirmation):
 *   npx dotenv -e .env.production -- npx tsx scripts/reconcile-r2.ts --delete --confirm-prod
 *
 * Safety guards built in:
 *  - Dry-run is the default; --delete is required to remove anything.
 *  - Production requires an extra --confirm-prod flag.
 *  - Files modified in the last 24 hours are NEVER deleted, even with
 *    --delete (covers in-flight uploads whose 'complete' step hasn't
 *    fired yet).
 *  - Aborts if the DB returns zero referenced URLs (probably wrong
 *    env file / connection string) or if more than 80% of R2 keys
 *    look orphaned (sanity check against bad data).
 *  - Final stdin prompt requires typing the literal "delete N files"
 *    before any DeleteObject call goes out.
 */

import { createInterface } from 'node:readline/promises'

import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from '../src/generated/prisma/client'
import { extractR2KeyFromUrl, deleteR2KeyDirect } from '../src/lib/r2'

const FRESH_GRACE_HOURS = 24
const MAX_ORPHAN_RATIO = 0.8

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL is required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

function envPrefix(): 'production' | 'staging' {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'production' : 'staging'
}

// Determine the env segment of an R2 key.
// Most keys are `<env>/<type>/...`. Originals are `artworks-original/<env>/...`.
function keyEnv(key: string): string | null {
  const parts = key.split('/')
  if (parts[0] === 'artworks-original') return parts[1] ?? null
  return parts[0] ?? null
}

async function collectReferencedKeys(): Promise<Set<string>> {
  // Pull every URL-bearing column from every model that writes to R2.
  // Keep this list in sync with schema.prisma — any new *Url column
  // that targets R2 needs to be added here or its files become
  // orphan candidates on the next run.
  const [
    artworks,
    users,
    orders,
    exhibitions,
    slides,
    pages,
  ] = await Promise.all([
    prisma.artwork.findMany({
      select: { imageUrl: true, originalImageUrl: true, soundUrl: true, videoUrl: true },
    }),
    prisma.user.findMany({ select: { profileImageUrl: true, signatureUrl: true } }),
    prisma.printOrder.findMany({ select: { certificateUrl: true } }),
    prisma.exhibition.findMany({
      select: { thumbnailUrl: true, bannerUrl: true, featuredImageUrl: true },
    }),
    prisma.slide.findMany({ select: { imageUrl: true } }),
    prisma.pageContent.findMany({ select: { bannerImageUrl: true } }),
  ])

  const referenced = new Set<string>()
  const add = (url: string | null | undefined) => {
    if (!url) return
    const key = extractR2KeyFromUrl(url)
    if (key) referenced.add(key)
  }

  for (const a of artworks) {
    add(a.imageUrl)
    add(a.originalImageUrl)
    add(a.soundUrl)
    add(a.videoUrl)
  }
  for (const u of users) {
    add(u.profileImageUrl)
    add(u.signatureUrl)
  }
  for (const o of orders) add(o.certificateUrl)
  for (const e of exhibitions) {
    add(e.thumbnailUrl)
    add(e.bannerUrl)
    add(e.featuredImageUrl)
  }
  for (const s of slides) add(s.imageUrl)
  for (const p of pages) add(p.bannerImageUrl)

  return referenced
}

async function listR2KeysWithMeta(): Promise<{ key: string; lastModified: Date | null }[]> {
  // listAllR2Keys returns only keys; for the freshness grace window
  // we need LastModified. Re-do the list here with a similar shape
  // but keeping the timestamp. (No need to share with the helper —
  // most callers don't want LastModified.)
  const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
  const bucket = process.env.R2_BUCKET_NAME!
  const out: { key: string; lastModified: Date | null }[] = []
  let token: string | undefined
  do {
    const res = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) out.push({ key: obj.Key, lastModified: obj.LastModified ?? null })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}

async function promptConfirm(expected: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Type \`${expected}\` to proceed (anything else aborts): `)
  rl.close()
  return answer.trim() === expected
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const doDelete = args.has('--delete')
  const confirmProd = args.has('--confirm-prod')
  const env = envPrefix()

  console.log('━'.repeat(72))
  console.log(`R2 reconciliation — env: ${env.toUpperCase()}`)
  console.log(`Mode: ${doDelete ? 'DELETE (will remove orphans)' : 'DRY-RUN (no changes)'}`)
  console.log('━'.repeat(72))

  if (env === 'production' && doDelete && !confirmProd) {
    console.error(
      '\nRefusing to delete in production without --confirm-prod. ' +
        'Run again with both flags if this is really intended.',
    )
    process.exit(1)
  }

  console.log('\nGathering referenced URLs from DB…')
  const referenced = await collectReferencedKeys()
  console.log(`  → ${referenced.size} R2-pointing URLs in DB`)
  if (referenced.size === 0) {
    console.error(
      '\nDB returned ZERO referenced R2 URLs. That almost certainly means ' +
        'the script is connected to the wrong database. Aborting before any delete.',
    )
    process.exit(1)
  }

  console.log('\nListing R2 keys (paginated)…')
  const allKeys = await listR2KeysWithMeta()
  console.log(`  → ${allKeys.length} total keys in bucket`)

  const envKeys = allKeys.filter(({ key }) => keyEnv(key) === env)
  console.log(`  → ${envKeys.length} keys in env "${env}"`)

  const now = Date.now()
  const freshnessCutoff = now - FRESH_GRACE_HOURS * 60 * 60 * 1000

  const orphans: { key: string; lastModified: Date | null }[] = []
  const skippedFresh: { key: string; lastModified: Date | null }[] = []
  for (const item of envKeys) {
    if (referenced.has(item.key)) continue
    if (item.lastModified && item.lastModified.getTime() > freshnessCutoff) {
      skippedFresh.push(item)
      continue
    }
    orphans.push(item)
  }

  console.log('\n── Summary ─────────────────────────────────────────────────────────')
  console.log(`  Total in env:         ${envKeys.length}`)
  console.log(`  Referenced by DB:     ${envKeys.length - orphans.length - skippedFresh.length}`)
  console.log(`  Skipped (< ${FRESH_GRACE_HOURS}h old):  ${skippedFresh.length}`)
  console.log(`  Orphans (deletable):  ${orphans.length}`)

  if (envKeys.length > 0) {
    const ratio = orphans.length / envKeys.length
    if (ratio > MAX_ORPHAN_RATIO && doDelete) {
      console.error(
        `\nRefusing to delete: ${(ratio * 100).toFixed(0)}% of keys look orphaned ` +
          `(threshold ${(MAX_ORPHAN_RATIO * 100).toFixed(0)}%). ` +
          'This is almost certainly a bad config — wrong DB, wrong bucket, or wrong env. ' +
          'Re-run with the right env file or fix the ratio threshold.',
      )
      process.exit(1)
    }
  }

  if (orphans.length === 0) {
    console.log('\nNo orphans to clean up. Done.')
    return
  }

  // Sort by lastModified ascending for readable output.
  orphans.sort((a, b) => {
    const ta = a.lastModified?.getTime() ?? 0
    const tb = b.lastModified?.getTime() ?? 0
    return ta - tb
  })

  console.log('\n── Orphan keys ─────────────────────────────────────────────────────')
  for (const { key, lastModified } of orphans) {
    const stamp = lastModified ? lastModified.toISOString() : 'unknown'
    console.log(`  ${stamp}  ${key}`)
  }

  if (!doDelete) {
    console.log('\nDry-run complete. Re-run with --delete to remove the above.')
    return
  }

  const confirmPhrase = `delete ${orphans.length} files in ${env}`
  console.log(`\nAbout to delete ${orphans.length} object(s) from "${env}".`)
  const confirmed = await promptConfirm(confirmPhrase)
  if (!confirmed) {
    console.log('Aborted. No files were deleted.')
    return
  }

  console.log('\nDeleting…')
  let ok = 0
  let failed = 0
  for (const { key } of orphans) {
    try {
      await deleteR2KeyDirect(key)
      ok++
    } catch (err) {
      failed++
      console.error(`  ✗ ${key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.log(`\nDone. Deleted: ${ok}, Failed: ${failed}`)
}

main()
  .catch((err) => {
    console.error('Reconciliation failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
