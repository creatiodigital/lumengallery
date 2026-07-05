import prisma from '@/lib/prisma'

// Single-row SiteSettings accessors (row id 1). Absence of the row means
// every flag sits at its default — the first toggle creates it.

/**
 * Emergency kill switch — when true, every public purchase surface hides
 * (prints catalog, Order Print CTAs, wizard, cart, checkout, deep links) and
 * new payment intents are refused. Read per request by the gated pages.
 */
export async function getPurchasesPaused(): Promise<boolean> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { purchasesPaused: true },
  })
  return settings?.purchasesPaused ?? false
}

export async function setPurchasesPaused(paused: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: { purchasesPaused: paused },
    create: { id: 1, purchasesPaused: paused },
  })
}
