'use client'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { SpecList } from '@/components/print/SpecList/SpecList'
import { Text } from '@/components/ui/Typography'
import { editionLabel } from '@/lib/editions/editionLabel'
import type { CartItem } from '@/lib/cart/types'

import styles from './CartItemDetails.module.scss'

type Props = {
  item: CartItem
  /**
   * Thumbnail box size in px. The frame is a SQUARE of this size and the art
   * is contained inside it (never cropped) — so portrait and landscape prints
   * take the same footprint and every row's columns line up. Only on narrow
   * phones (≤ 400px, the xs breakpoint) does the photo instead span the full
   * card width at its natural aspect ratio.
   */
  thumbHeight?: number
  /** Per-line server-revalidation error (checkout). */
  error?: string
  /**
   * Whether to show the inline "Limited edition" tag. The cart hides it (its
   * price panel shows the edition); checkout keeps it.
   */
  showEditionTag?: boolean
}

/**
 * Shared presentation of a cart item — thumbnail + artist/title + aligned spec
 * list + limited-edition tag/countdown. Used by both the cart line and the
 * checkout recap so the two surfaces never drift in look or markup. Each
 * surface supplies its own controls (cart: stepper/remove; checkout: read-only
 * qty) around this block.
 */
export const CartItemDetails = ({
  item,
  thumbHeight = 120,
  error,
  showEditionTag = true,
}: Props) => {
  return (
    <div
      className={styles.item}
      style={{ '--thumb-size': `${thumbHeight}px` } as React.CSSProperties}
    >
      <ProtectedImage
        src={item.thumbnailUrl}
        alt={item.title}
        // 0×0 + CSS sizing is next/image's responsive pattern for sources
        // whose intrinsic size we don't know — it lets the same <img> render
        // as a contained square on desktop and full-width/natural-height on
        // mobile, switched purely in the stylesheet.
        width={0}
        height={0}
        wrapperClassName={styles.thumb}
        className={styles.thumbImage}
      />

      <div className={styles.details}>
        <Text as="span" size="xs" className={styles.artist}>
          {item.artistName}
        </Text>
        <Text as="p" font="serif" size="lg" className={styles.title}>
          {item.title}
        </Text>

        {showEditionTag && (
          <Text as="span" size="md" className={styles.edition}>
            {editionLabel(item.editionType, item.editionName)}
          </Text>
        )}

        {/* No per-surface row budget: the cart and checkout render the same
            line, and giving them different budgets meant the same purchase
            showed five specs on one page and three plus a toggle on the next.
            SpecList owns the budget for every surface. */}
        <SpecList specs={item.specsSummary} className={styles.specs} />

        {error && (
          <Text as="span" size="xs" className={styles.errorText}>
            {error}
          </Text>
        )}
      </div>
    </div>
  )
}
