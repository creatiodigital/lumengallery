'use client'

import { useMemo, useRef, useState } from 'react'

import { getPrintsCatalogPage } from '@/app/prints/actions'
import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import type { SelectOption } from '@/components/ui/SelectDropdown'

import { PrintsToolbar } from './PrintsToolbar'
import styles from './prints.module.scss'
import {
  displayArtist,
  PRINTS_PAGE_SIZE,
  type EditionFilter,
  type PrintArtistOption,
  type PrintArtwork,
} from './types'

type Props = {
  /** SSR'd first page — seeds the grid so first paint needs no client fetch. */
  initialItems: PrintArtwork[]
  /** Total matching the unfiltered catalog (drives the initial page count). */
  initialTotal: number
  /** Distinct artists with prints, fetched once on the server. */
  artistOptions: PrintArtistOption[]
}

export const PrintsBrowser = ({ initialItems, initialTotal, artistOptions }: Props) => {
  const [artistId, setArtistId] = useState('')
  const [edition, setEdition] = useState<EditionFilter>('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState(initialItems)
  const [totalCount, setTotalCount] = useState(initialTotal)
  const [loading, setLoading] = useState(false)

  // Monotonic request id: every fetch claims one, and only the latest may write
  // state. Guards against out-of-order responses from rapid filter/page clicks.
  const reqIdRef = useRef(0)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const pageCount = Math.max(1, Math.ceil(totalCount / PRINTS_PAGE_SIZE))

  const runFetch = async (nextPage: number, nextArtist: string, nextEdition: EditionFilter) => {
    const reqId = (reqIdRef.current += 1)
    setLoading(true)
    try {
      const res = await getPrintsCatalogPage({
        page: nextPage,
        artistId: nextArtist,
        edition: nextEdition,
      })
      if (reqId !== reqIdRef.current) return // a newer request superseded this one
      setItems(res.items)
      setTotalCount(res.totalCount)
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }

  // Filter changes always reset to page 1 and refetch from the server.
  const handleArtistChange = (value: string) => {
    setArtistId(value)
    setPage(1)
    void runFetch(1, value, edition)
  }

  const handleEditionChange = (value: string) => {
    const next = value as EditionFilter
    setEdition(next)
    setPage(1)
    void runFetch(1, artistId, next)
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    void runFetch(nextPage, artistId, edition)
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ArtworkGrid reads `author`, which can be null on the row — fall back to the
  // user's name so every card always shows the artist.
  const gridArtworks = useMemo(
    () => items.map((artwork) => ({ ...artwork, author: displayArtist(artwork) })),
    [items],
  )

  const artistSelectOptions = useMemo<SelectOption<string>[]>(
    () => [{ value: '', label: 'All artists' }, ...artistOptions],
    [artistOptions],
  )

  // Artists listed here always have prints (we never list artists with none),
  // so an empty grid is always a filter combination — never "no prints at all".
  const editionDesc =
    edition === 'limited' ? 'limited-edition' : edition === 'open' ? 'open-edition' : null
  const emptyMessage =
    artistId && editionDesc
      ? `No ${editionDesc} prints by this artist — try another edition type or artist.`
      : editionDesc
        ? `No ${editionDesc} prints available right now.`
        : 'No prints match the current filters.'

  return (
    <>
      <PrintsToolbar
        artistOptions={artistSelectOptions}
        artistId={artistId}
        onArtistChange={handleArtistChange}
        editionId={edition}
        onEditionChange={handleEditionChange}
      />

      <div ref={resultsRef} className={styles.results} aria-busy={loading}>
        {totalCount === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <>
            <div className={loading ? styles.gridLoading : undefined}>
              <ArtworkGrid artworks={gridArtworks} withOrderPrint />
            </div>
            {loading && (
              <div className={styles.loadingOverlay} aria-hidden>
                <span className={styles.spinner} />
              </div>
            )}
            <Pagination page={page} pageCount={pageCount} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </>
  )
}
