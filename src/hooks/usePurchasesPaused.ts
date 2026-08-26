'use client'

import { useEffect, useState } from 'react'

import { getPublicPurchasesPaused } from '@/app/prints/actions'

/**
 * The admin purchases kill switch, for client surfaces that offer a print.
 *
 * Read on the client because the surfaces that need it are shared across
 * routes — the artwork body serves both its own page and the in-exhibition
 * modal, and the grid serves /prints, the artist page and the exhibition page.
 * One hook covers all of them.
 *
 * The cache is module-level and deliberately shared: it used to live inside
 * ArtworkDetailBody, so a second surface would have kept its own copy and
 * re-POSTed the action on every navigation between a grid and a work.
 *
 * Fails OPEN (visible CTA). A blip in this read must not take commerce off the
 * site, and it cannot cause a bad sale: the wizard route and the payment
 * actions enforce the pause server-side regardless. The short TTL keeps an
 * admin's flip visible within a minute.
 */
const TTL_MS = 60 * 1000

let cache: { value: boolean; at: number } | null = null

export function usePurchasesPaused(): boolean {
  const [paused, setPaused] = useState(() => cache?.value ?? false)

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) {
      setPaused(cache.value)
      return
    }
    getPublicPurchasesPaused()
      .then((value) => {
        cache = { value, at: Date.now() }
        setPaused(value)
      })
      .catch(() => {
        // Transport failure — keep the fail-open default.
      })
  }, [])

  return paused
}
