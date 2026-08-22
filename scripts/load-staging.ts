/**
 * Read-only load probe for staging — how does the site behave with many people
 * on it at once, and in particular the 3D exhibition spaces?
 *
 * The 3D rooms are the interesting case because a single visitor pulls far more
 * bytes than any other page: the room GLB, the environment HDR and every
 * artwork texture. Those come from R2 rather than Vercel (see AR-127), so a
 * busy opening night is really two different services under load at once, and
 * this measures them separately.
 *
 * SAFETY — this script only ever issues GET requests, and only to paths it
 * discovered by reading the site's own HTML. It cannot create an order, a
 * payment intent, a hold or a row of any kind. Nothing here touches the money
 * path; that is what the runbook's Phase 08 is for.
 *
 * Usage:
 *   npx tsx scripts/load-staging.ts
 *   npx tsx scripts/load-staging.ts --vus 25 --seconds 60
 *   npx tsx scripts/load-staging.ts --base https://staging.theartroom.gallery --assets
 *
 *   --vus N       concurrent virtual visitors (default 10)
 *   --seconds N   how long to sustain them (default 20)
 *   --base URL    target origin (default staging)
 *   --assets      also pull the 3D payload (GLB/HDR/textures) — the honest
 *                 test, and the expensive one: this is real R2 egress.
 *
 * READ THE CAVEATS printed at the end of the run before believing any number.
 */

type Sample = { url: string; label: string; ms: number; status: number; bytes: number }

const arg = (flag: string, fallback: string): string => {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (flag: string): boolean => process.argv.includes(flag)

const BASE = arg('--base', 'https://staging.theartroom.gallery').replace(/\/$/, '')
const VUS = Math.max(1, Number(arg('--vus', '10')))
const SECONDS = Math.max(1, Number(arg('--seconds', '20')))
const WITH_ASSETS = has('--assets')
const REQUEST_TIMEOUT_MS = 30_000

/** Percentile from an unsorted list. Nearest-rank, which is what you want for
 *  latency: p95 is a real observed request, not an interpolation. */
const pct = (values: number[], p: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

const fmtMs = (n: number) => `${Math.round(n)}ms`
const fmtBytes = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`

async function timedGet(url: string, label: string): Promise<Sample> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'art-room-load-probe (read-only)' },
      redirect: 'follow',
    })
    // Drain the body — otherwise we time the headers, not the transfer, which
    // is exactly the wrong measurement for a 12MB room.
    const buf = await res.arrayBuffer()
    return {
      url,
      label,
      ms: performance.now() - started,
      status: res.status,
      bytes: buf.byteLength,
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return { url, label, ms: performance.now() - started, status: aborted ? 408 : 0, bytes: 0 }
  } finally {
    clearTimeout(timer)
  }
}

/** Pull real URLs out of the site rather than guessing them, so the probe
 *  exercises whatever is actually published today. */
async function discover(): Promise<{ label: string; url: string }[]> {
  const targets: { label: string; url: string }[] = [
    { label: 'home', url: `${BASE}/` },
    { label: 'prints catalogue', url: `${BASE}/prints` },
    { label: 'exhibitions index', url: `${BASE}/exhibitions` },
    { label: 'artists index', url: `${BASE}/artists` },
  ]

  const grab = async (path: string, re: RegExp, label: string, max: number) => {
    const res = await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'art-room-load-probe' } })
    if (!res.ok) return []
    const html = await res.text()
    const found = [...new Set([...html.matchAll(re)].map((m) => m[1]))].slice(0, max)
    return found.map((slug) => ({
      label,
      url: `${BASE}${slug.startsWith('/') ? slug : `/${slug}`}`,
    }))
  }

  targets.push(
    ...(await grab('/exhibitions', /href="(\/exhibitions\/[^"?#]+)"/g, '3D exhibition', 3)),
  )
  targets.push(...(await grab('/prints', /href="(\/artworks\/[^"?#]+)"/g, 'artwork page', 5)))

  if (WITH_ASSETS) {
    // The heavy payload behind a 3D room: models, environment maps, textures.
    // These live on R2, so they are a different service from everything above.
    for (const t of targets.filter((x) => x.label === '3D exhibition')) {
      const res = await fetch(t.url, { headers: { 'user-agent': 'art-room-load-probe' } })
      if (!res.ok) continue
      const html = await res.text()
      const assets = [
        ...new Set(
          [...html.matchAll(/https?:\/\/[^"'\s]+\.(?:glb|hdr|ktx2|jpg|png|webp)/g)].map(
            (m) => m[0],
          ),
        ),
      ]
      for (const a of assets.slice(0, 12)) {
        targets.push({
          label: a.endsWith('.glb') || a.endsWith('.hdr') ? '3D asset (heavy)' : '3D texture',
          url: a,
        })
      }
    }
  }

  return targets
}

async function main() {
  console.log(`\n  Target        ${BASE}`)
  console.log(`  Load          ${VUS} concurrent visitors for ${SECONDS}s`)
  console.log(
    `  3D payload    ${WITH_ASSETS ? 'INCLUDED (real R2 egress)' : 'skipped — pass --assets to include'}`,
  )
  console.log(`  Method        GET only. This probe cannot write anything.\n`)

  const targets = await discover()
  if (targets.length === 0) {
    console.error('  Nothing discovered — is the base URL right, and is staging up?')
    process.exit(1)
  }
  console.log(`  Discovered ${targets.length} URLs:`)
  for (const label of [...new Set(targets.map((t) => t.label))]) {
    console.log(`    ${targets.filter((t) => t.label === label).length}× ${label}`)
  }

  const samples: Sample[] = []
  const deadline = Date.now() + SECONDS * 1000
  let issued = 0

  // Each virtual visitor walks the target list in a different order and loops
  // until time is up — closer to real traffic than hammering one URL.
  const visitor = async (n: number) => {
    let i = n
    while (Date.now() < deadline) {
      const t = targets[i++ % targets.length]
      samples.push(await timedGet(t.url, t.label))
      issued++
    }
  }

  console.log(`\n  Running…`)
  const started = performance.now()
  await Promise.all(Array.from({ length: VUS }, (_, n) => visitor(n)))
  const elapsed = (performance.now() - started) / 1000

  // ── Report ──────────────────────────────────────────────────────────
  const byLabel = new Map<string, Sample[]>()
  for (const s of samples) byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), s])

  console.log(
    `\n  ${issued} requests in ${elapsed.toFixed(1)}s — ${(issued / elapsed).toFixed(1)} req/s\n`,
  )
  console.log(
    `  ${'what'.padEnd(20)} ${'n'.padStart(5)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'max'.padStart(8)}  ${'bytes'.padStart(8)}  errors`,
  )
  console.log(`  ${'─'.repeat(88)}`)
  for (const [label, list] of [...byLabel.entries()].sort()) {
    const ok = list.filter((s) => s.status >= 200 && s.status < 400)
    const ms = ok.map((s) => s.ms)
    const bad = list.length - ok.length
    const avgBytes = ok.length ? ok.reduce((n, s) => n + s.bytes, 0) / ok.length : 0
    console.log(
      `  ${label.padEnd(20)} ${String(list.length).padStart(5)} ` +
        `${fmtMs(pct(ms, 50)).padStart(8)} ${fmtMs(pct(ms, 95)).padStart(8)} ` +
        `${fmtMs(pct(ms, 99)).padStart(8)} ${fmtMs(Math.max(0, ...ms)).padStart(8)}  ` +
        `${fmtBytes(avgBytes).padStart(8)}  ${bad > 0 ? `${bad} ✗` : '—'}`,
    )
  }

  const statuses = new Map<number, number>()
  for (const s of samples) statuses.set(s.status, (statuses.get(s.status) ?? 0) + 1)
  const notOk = [...statuses.entries()].filter(([code]) => code < 200 || code >= 400)
  if (notOk.length > 0) {
    console.log(`\n  Non-success responses:`)
    for (const [code, n] of notOk.sort((a, b) => b[1] - a[1])) {
      const meaning =
        code === 429
          ? 'RATE LIMITED — you are measuring the limiter, not the app'
          : code === 408
            ? 'timed out client-side'
            : code === 0
              ? 'connection failed'
              : ''
      console.log(`    ${code || 'ERR'} × ${n}  ${meaning}`)
    }
  }

  const totalBytes = samples.reduce((n, s) => n + s.bytes, 0)
  console.log(`\n  Transferred ${fmtBytes(totalBytes)} total.`)

  console.log(`
  Before believing any of this:
    · Staging shares the DEV database. Slow queries here are dev-data slow,
      not production slow.
    · Every request came from ONE IP. The app rate-limits per client IP, so a
      429 above means the limiter worked, not that the site fell over. Real
      traffic arrives from many addresses and will behave differently.
    · Vercel serves the HTML/JS; R2 serves the 3D payload. If '3D asset (heavy)'
      is slow while pages are fast, the bottleneck is R2 egress, not the app.
    · This is bandwidth someone pays for. Long runs with --assets cost money.
    · A cold serverless function is slower than a warm one; the first samples
      in each run are not representative.
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
