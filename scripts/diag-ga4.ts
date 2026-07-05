// Read-only GA4 connectivity check: verifies the service-account key +
// property id and prints the three dashboard datasets.
// Run with: npx dotenv -e .env.local -- npx tsx scripts/diag-ga4.ts
import { fetchGa4Snapshot, isGa4Configured } from '@/lib/analytics/ga4'

async function main() {
  if (!isGa4Configured()) {
    console.log('GA4 NOT configured — set GA4_PROPERTY_ID and GA_SERVICE_ACCOUNT_KEY in .env.local')
    process.exitCode = 1
    return
  }
  const snapshot = await fetchGa4Snapshot()
  console.log('— Top artworks (30d page views) —')
  for (const a of snapshot.topArtworks) console.log(`  ${a.views}\t/artworks/${a.slug}`)
  console.log('— Countries (30d sessions) —')
  for (const c of snapshot.countries) console.log(`  ${c.sessions}\t${c.country}`)
  console.log('— Channels (30d sessions) —')
  for (const c of snapshot.channels) console.log(`  ${c.sessions}\t${c.channel}`)
}

main().catch((err) => {
  console.error('GA4 diagnostic failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
