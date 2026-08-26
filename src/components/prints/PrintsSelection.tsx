'use client'

import { useMemo, useState } from 'react'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SelectOption } from '@/components/ui/SelectDropdown'
import type { GallerySelectionCard } from '@/lib/queries/getGallerySelection'

import { PrintsToolbar } from './PrintsToolbar'
import styles from './prints.module.scss'
import type { EditionFilter } from './types'

type Props = {
  /** The gallery's selection, already ordered. Small and complete, so every
   *  filter below is a synchronous pass over this array — no server round-trip,
   *  no pagination, no loading state to cover. */
  selection: GallerySelectionCard[]
}

export const PrintsSelection = ({ selection }: Props) => {
  const [artistName, setArtistName] = useState('')
  const [edition, setEdition] = useState<EditionFilter>('')

  // Built from the selection itself, so the dropdown can never offer an artist
  // with nothing on the page. Keyed by display name — the selection carries no
  // user id, and two artists sharing a display name would already be
  // indistinguishable to a buyer reading the grid.
  const artistOptions = useMemo<SelectOption<string>[]>(() => {
    const names = [...new Set(selection.map((c) => c.artistName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    return [
      { value: '', label: 'All artists' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [selection])

  const visible = useMemo(
    () =>
      selection.filter(
        (c) =>
          (artistName === '' || c.artistName === artistName) &&
          (edition === '' || c.sale.editionType === edition),
      ),
    [selection, artistName, edition],
  )

  // Every artist in the dropdown has at least one work here, so an empty grid is
  // always a filter combination — never "no prints at all".
  const editionDesc =
    edition === 'limited' ? 'limited-edition' : edition === 'open' ? 'open-edition' : null
  const emptyMessage =
    artistName && editionDesc
      ? `No ${editionDesc} prints by this artist — try another edition type or artist.`
      : editionDesc
        ? `No ${editionDesc} prints in the current selection.`
        : 'No prints match the current filters.'

  return (
    <>
      <PrintsToolbar
        artistOptions={artistOptions}
        artistId={artistName}
        onArtistChange={setArtistName}
        editionId={edition}
        onEditionChange={(value) => setEdition(value as EditionFilter)}
      />

      <div className={styles.results}>
        {visible.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <ArtworkGrid artworks={visible} />
        )}
      </div>
    </>
  )
}
