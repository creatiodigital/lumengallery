import prisma from '@/lib/prisma'
import { captureError } from '@/lib/observability/captureError'

// Single-row SiteSettings accessors (row id 1). Absence of the row means
// every flag sits at its default — the first toggle creates it.

/**
 * Emergency kill switch — when true, every public purchase surface hides
 * (prints catalog, Order Print CTAs, wizard, cart, checkout, deep links) and
 * new payment intents are refused. Read per request by the gated pages.
 *
 * FAILS OPEN (false): if the read errors — most importantly when the
 * SiteSettings table doesn't exist yet because a deploy landed before the
 * manual schema sync — the site keeps selling instead of 500ing the whole
 * purchase funnel. The pause is a best-effort gate, not a security boundary.
 */
export async function getPurchasesPaused(): Promise<boolean> {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { purchasesPaused: true },
    })
    return settings?.purchasesPaused ?? false
  } catch (err) {
    captureError(err, { flow: 'content', stage: 'purchases-paused-read', level: 'warning' })
    return false
  }
}

export async function setPurchasesPaused(paused: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: { purchasesPaused: paused },
    create: { id: 1, purchasesPaused: paused },
  })
}
