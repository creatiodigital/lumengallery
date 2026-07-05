import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Thin adapter over the GA4 Data API. Server-only: credentials come from
// GA_SERVICE_ACCOUNT_KEY (full service-account JSON, one line) and
// GA4_PROPERTY_ID (the numeric property id from GA4 Admin → Property
// settings). The GA tag only runs on production, so whichever environment
// calls this, the numbers are always production traffic.

export type Ga4ArtworkViews = { slug: string; views: number }
export type Ga4CountryRow = { country: string; sessions: number }
export type Ga4ChannelRow = { channel: string; sessions: number }

export type Ga4Snapshot = {
  topArtworks: Ga4ArtworkViews[]
  countries: Ga4CountryRow[]
  channels: Ga4ChannelRow[]
}

const RANGE = { startDate: '30daysAgo', endDate: 'today' }
// Fetch more artwork paths than we display: rows are per-path and get
// filtered to exact /artworks/<slug> matches below.
const ARTWORK_ROW_LIMIT = 50
const COUNTRY_LIMIT = 10
const CHANNEL_LIMIT = 8

type Ga4Config = { propertyId: string; clientEmail: string; privateKey: string }

function getConfig(): Ga4Config | null {
  const propertyId = process.env.GA4_PROPERTY_ID
  const rawKey = process.env.GA_SERVICE_ACCOUNT_KEY
  if (!propertyId || !rawKey) return null
  try {
    const parsed = JSON.parse(rawKey) as { client_email?: string; private_key?: string }
    if (!parsed.client_email || !parsed.private_key) return null
    return { propertyId, clientEmail: parsed.client_email, privateKey: parsed.private_key }
  } catch {
    return null
  }
}

export function isGa4Configured(): boolean {
  return getConfig() !== null
}

// Module-level client reuse across invocations of a warm serverless instance.
let client: BetaAnalyticsDataClient | null = null

function getClient(config: Ga4Config): BetaAnalyticsDataClient {
  client ??= new BetaAnalyticsDataClient({
    credentials: { client_email: config.clientEmail, private_key: config.privateKey },
  })
  return client
}

/** Exact /artworks/<slug> pages only — wizard/checkout subroutes excluded. */
const ARTWORK_PATH = /^\/artworks\/([^/]+)$/

/**
 * One batched Data API call → the three dashboard datasets. Throws when not
 * configured or on API failure — the caller owns graceful degradation.
 */
export async function fetchGa4Snapshot(): Promise<Ga4Snapshot> {
  const config = getConfig()
  if (!config) throw new Error('GA4 is not configured')

  const [response] = await getClient(config).batchRunReports({
    property: `properties/${config.propertyId}`,
    requests: [
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'BEGINS_WITH', value: '/artworks/' },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: ARTWORK_ROW_LIMIT,
      },
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: COUNTRY_LIMIT,
      },
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: CHANNEL_LIMIT,
      },
    ],
  })

  const [artworkReport, countryReport, channelReport] = response.reports ?? []

  const topArtworks: Ga4ArtworkViews[] = []
  for (const row of artworkReport?.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? ''
    const match = ARTWORK_PATH.exec(path)
    if (!match) continue
    topArtworks.push({ slug: match[1], views: Number(row.metricValues?.[0]?.value ?? 0) })
  }

  const countries: Ga4CountryRow[] = (countryReport?.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }))

  const channels: Ga4ChannelRow[] = (channelReport?.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }))

  return { topArtworks, countries, channels }
}
