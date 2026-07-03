'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './Pagination.module.scss'

type PaginationProps = {
  /** Current page, 1-based. */
  page: number
  /** Total number of pages (>= 1). */
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right'

// Numbered pages with ellipsis truncation. Up to 7 pages render in full;
// beyond that we keep the first, the last, and a window around the current
// page, collapsing the gaps to "…".
const buildPageItems = (page: number, pageCount: number): PageItem[] => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const items: PageItem[] = [1]
  const left = Math.max(2, page - 1)
  const right = Math.min(pageCount - 1, page + 1)

  if (left > 2) items.push('ellipsis-left')
  for (let p = left; p <= right; p += 1) items.push(p)
  if (right < pageCount - 1) items.push('ellipsis-right')

  items.push(pageCount)
  return items
}

/**
 * Numbered page pagination (1 · 2 · 3 … + Prev/Next) for buyer-facing lists.
 * Squared per the client-facing control convention. Renders nothing for a
 * single page. Clicking the current page (or stepping past either end) is a
 * no-op — the parent owns the actual fetch.
 */
export const Pagination = ({ page, pageCount, onPageChange, className }: PaginationProps) => {
  if (pageCount <= 1) return null

  const go = (target: number) => {
    if (target < 1 || target > pageCount || target === page) return
    onPageChange(target)
  }

  return (
    <nav className={`${styles.pagination} ${className ?? ''}`} aria-label="Pagination">
      <Button
        variant="bare"
        className={styles.arrow}
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        label="Prev"
        iconLeft={<ChevronLeft size={16} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />}
      />

      <ul className={styles.pages}>
        {buildPageItems(page, pageCount).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <Button
                variant="bare"
                className={`${styles.page} ${item === page ? styles.pageActive : ''}`}
                onClick={() => go(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
              >
                {item}
              </Button>
            </li>
          ) : (
            <li key={item} className={styles.ellipsis} aria-hidden>
              …
            </li>
          ),
        )}
      </ul>

      <Button
        variant="bare"
        className={styles.arrow}
        onClick={() => go(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        label="Next"
        iconRight={<ChevronRight size={16} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />}
      />
    </nav>
  )
}
