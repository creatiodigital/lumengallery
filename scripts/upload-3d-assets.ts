/**
 * One-off uploader: copies the 3D asset subset of public/assets to R2
 * under the `app/assets/` prefix (single canonical copy, all envs).
 *
 *   Upload:        npx dotenv -e .env.local -- npx tsx scripts/upload-3d-assets.ts
 *   Update CORS:   npx dotenv -e .env.local -- npx tsx scripts/upload-3d-assets.ts --cors
 *
 * CORS is GET-MERGE-PUT: PutBucketCors REPLACES the whole bucket config,
 * and this bucket already carries CORS rules for artist browser uploads —
 * those existing rules are always preserved.
 *
 * Idempotent: re-running skips objects whose remote size already matches.
 */
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  type CORSRule,
} from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
const BUCKET = process.env.R2_BUCKET_NAME!

const LOCAL_ROOT = path.join(process.cwd(), 'public', 'assets')
const KEY_PREFIX = 'app/assets'

// 3D scope only — 2D UI assets (email-logo, landing, helpers, person.png)
// stay on Vercel by design. (objects/sofa was deleted, not migrated.)
const INCLUDE_DIRS = ['materials', 'spaces', 'hdri']
const INCLUDE_FILES = ['human.glb']

const CONTENT_TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.hdr': 'application/octet-stream',
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const ALLOWED_ORIGINS = [
  'https://theartroom.gallery',
  'https://www.theartroom.gallery',
  'https://staging.theartroom.gallery',
  'http://localhost:3001',
]

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name !== '.DS_Store') files.push(full)
  }
  return files
}

async function collectFiles(): Promise<string[]> {
  const files: string[] = []
  for (const dir of INCLUDE_DIRS) files.push(...(await walk(path.join(LOCAL_ROOT, dir))))
  for (const f of INCLUDE_FILES) files.push(path.join(LOCAL_ROOT, f))
  return files
}

async function remoteSizeMatches(key: string, size: number): Promise<boolean> {
  try {
    const head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return head.ContentLength === size
  } catch {
    return false
  }
}

async function uploadAll(): Promise<void> {
  const files = await collectFiles()
  let uploaded = 0
  let skipped = 0
  let bytes = 0
  for (const file of files) {
    const rel = path.relative(LOCAL_ROOT, file).split(path.sep).join('/')
    const key = `${KEY_PREFIX}/${rel}`
    const { size } = await stat(file)
    if (await remoteSizeMatches(key, size)) {
      skipped++
      console.log(`skip   ${key}`)
      continue
    }
    const ext = path.extname(file).toLowerCase()
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: createReadStream(file),
        ContentLength: size,
        ContentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
        CacheControl: CACHE_CONTROL,
      }),
    )
    uploaded++
    bytes += size
    console.log(`upload ${key} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  }
  console.log(
    `\nDone. ${uploaded} uploaded (${(bytes / 1024 / 1024).toFixed(1)} MB), ` +
      `${skipped} already current, ${files.length} total local files in scope.`,
  )
}

async function updateCors(): Promise<void> {
  let existing: CORSRule[] = []
  try {
    const current = await r2.send(new GetBucketCorsCommand({ Bucket: BUCKET }))
    existing = current.CORSRules ?? []
  } catch {
    // No CORS configured yet — start from empty.
  }
  console.log(`Existing CORS rules: ${JSON.stringify(existing, null, 2)}`)

  const wanted: CORSRule = {
    AllowedMethods: ['GET', 'HEAD'],
    AllowedOrigins: ALLOWED_ORIGINS,
    AllowedHeaders: ['*'],
    MaxAgeSeconds: 86400,
  }
  const alreadyThere = existing.some(
    (rule) =>
      ALLOWED_ORIGINS.every((o) => rule.AllowedOrigins?.includes(o)) &&
      rule.AllowedMethods?.includes('GET'),
  )
  if (alreadyThere) {
    console.log('GET rule for all required origins already present — nothing to do.')
    return
  }
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: { CORSRules: [...existing, wanted] },
    }),
  )
  console.log(`Appended GET rule for: ${ALLOWED_ORIGINS.join(', ')} (existing rules preserved)`)
}

const main = process.argv.includes('--cors') ? updateCors : uploadAll
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
