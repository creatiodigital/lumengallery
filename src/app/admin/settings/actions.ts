'use server'

/**
 * Site-wide switches the admin flips from the dashboard. Currently one:
 * the purchases kill switch — see SiteSettings in schema.prisma.
 */
import { requireAdminAction } from '@/lib/authUtils'
import { getPurchasesPaused, setPurchasesPaused } from '@/lib/settings'
import { captureError } from '@/lib/observability/captureError'

type SettingsResult = { ok: true; paused: boolean } | { ok: false; error: string }

export async function getPurchasesPausedState(): Promise<SettingsResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    return { ok: true, paused: await getPurchasesPaused() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to read settings.' }
  }
}

/**
 * Flip the emergency kill switch. Takes effect on the next request for every
 * public purchase surface (they all read the flag per request) — no deploy,
 * no per-artwork changes.
 */
export async function togglePurchasesPaused(paused: boolean): Promise<SettingsResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    await setPurchasesPaused(paused)
    return { ok: true, paused }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'toggle-purchases-paused' })
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update settings.' }
  }
}
