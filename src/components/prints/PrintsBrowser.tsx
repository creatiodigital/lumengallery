'use client'

import { useMemo, useState } from 'react'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SelectOption } from '@/components/ui/SelectDropdown'

import { PrintsToolbar } from './PrintsToolbar'
import { displayArtist, type PrintArtwork } from './types'

type Props = {
  artworks: PrintArtwork[]
}

export const PrintsBrowser = ({ artworks }: Props) => {
  const [artistId, setArtistId] = useState('')

  // Unique artists (by user id) present in the print catalog, alphabetical.
  const artistOptions = useMemo<SelectOption<string>[]>(() => {
    const seen = new Map<string, string>()
    for (const artwork of artworks) {
      if (!seen.has(artwork.user.id)) seen.set(artwork.user.id, displayArtist(artwork))
    }
    const options = [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return [{ value: '', label: 'All artists' }, ...options]
  }, [artworks])

  // Map to the canonical ArtworkGrid shape; ensure the artist name is always
  // present (ArtworkGrid reads `author`, which can be null on the row, so fall
  // back to the user's name via displayArtist).
  const gridArtworks = useMemo(() => {
    const visible = artistId
      ? artworks.filter((artwork) => artwork.user.id === artistId)
      : artworks
    return visible.map((artwork) => ({ ...artwork, author: displayArtist(artwork) }))
  }, [artworks, artistId])

  return (
    <>
      <PrintsToolbar
        artistOptions={artistOptions}
        artistId={artistId}
        onArtistChange={setArtistId}
      />

      {gridArtworks.length === 0 ? (
        <EmptyState message="No prints by this artist yet. Try a different artist." />
      ) : (
        <ArtworkGrid artworks={gridArtworks} withOrderPrint />
      )}
    </>
  )
}
