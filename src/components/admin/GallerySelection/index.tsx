'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Text } from '@/components/ui/Typography'
import type { AdminSelectionRow } from '@/lib/queries/getGallerySelection'

import { AddArtworksModal } from './AddArtworksModal'
import { SelectionList } from './SelectionList'
import styles from './GallerySelection.module.scss'

export const GallerySelection = () => {
  const [rows, setRows] = useState<AdminSelectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/selected-prints')
    setRows(res.ok ? await res.json() : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleReorder = async (ids: string[]) => {
    // Optimistic: the drag already moved it on screen, and snapping back on a
    // slow round-trip reads as a failed drag.
    setRows((prev) => ids.map((id) => prev.find((r) => r.selectionId === id)!).filter(Boolean))
    try {
      const res = await fetch('/api/selected-prints/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) console.error('Reorder failed:', res.status)
    } catch (error) {
      // A rejected fetch (offline, dropped connection) throws before the line
      // below ever runs — without this catch, the optimistic order would be
      // left on screen with no confirmation it was ever persisted. This
      // screen's whole job is to never lie about what's saved, so `load()`
      // in `finally` always has the last word, success or failure.
      console.error('Error reordering selection:', error)
    } finally {
      void load()
    }
  }

  const handleRemove = async (selectionId: string) => {
    try {
      const res = await fetch(`/api/selected-prints/${selectionId}`, { method: 'DELETE' })
      if (!res.ok) console.error('Remove failed:', res.status)
    } catch (error) {
      // Same reasoning as handleReorder: a dropped response (the DELETE may
      // have landed server-side even though the client never heard back)
      // must not leave a removed row looking like it's still selected, or
      // vice versa. Reconcile unconditionally.
      console.error('Error removing selection:', error)
    } finally {
      void load()
    }
  }

  // Stable across renders: the picker's fetch effects list this in their deps,
  // and a fresh array every render would refire them mid-search.
  const excludeIds = useMemo(() => rows.map((r) => r.artwork.id), [rows])

  // Per-artist tally. Surfaced, never enforced: the owner asked for no cap, but
  // "four of these are by one artist" should not need counting by eye.
  const perArtist = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.artistName] = (acc[r.artistName] ?? 0) + 1
    return acc
  }, {})
  // Counted apart: a sold-out entry is a signal worth keeping on the page, a
  // withdrawn one is a gap to fill.
  const soldOutCount = rows.filter((r) => r.status === 'sold-out').length
  const withdrawnCount = rows.filter((r) => r.status === 'not-for-sale').length

  return (
    <div className={styles.screen}>
      {/* Tally left, the one action right. As a plain child of `.screen` — a
          flex column — the button stretched to a full-width black slab across
          the bottom of the page. */}
      <div className={styles.toolbar}>
        <div className={styles.header}>
          <Text font="dashboard" as="p" className={styles.tally}>
            {rows.length} works · {Object.keys(perArtist).length} artists
            {soldOutCount > 0 ? ` · ${soldOutCount} sold out` : ''}
            {withdrawnCount > 0 ? ` · ${withdrawnCount} hidden` : ''}
          </Text>
          <Text font="dashboard" as="p" className={styles.tallyDetail}>
            {Object.entries(perArtist)
              .map(([name, n]) => `${name} ${n}`)
              .join(' · ')}
          </Text>
        </div>

        <Button
          font="dashboard"
          variant="primary"
          label="Add artworks"
          onClick={() => setPickerOpen(true)}
        />
      </div>

      {loading ? null : rows.length === 0 ? (
        <EmptyState message="Nothing selected yet — /prints is showing its empty state." />
      ) : (
        <SelectionList rows={rows} onReorder={handleReorder} onRemove={handleRemove} />
      )}

      {pickerOpen && (
        <AddArtworksModal
          excludeIds={excludeIds}
          onClose={() => setPickerOpen(false)}
          onAdded={load}
        />
      )}
    </div>
  )
}
