'use client'

import { useCallback, useState } from 'react'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { SpecList } from '@/components/print/SpecList/SpecList'
import { HoldCountdown } from '@/components/cart/HoldCountdown/HoldCountdown'
import { useCart } from '@/lib/cart/useCart'
import { lineTotal } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'
import { formatEuro } from '@/lib/print-providers'

import styles from './CartLine.module.scss'

interface CartLineProps {
  item: CartItem
}

export const CartLine = ({ item }: CartLineProps) => {
  const { setQuantity, removeItem } = useCart()
  const { unitItemCents, lineItemCents } = lineTotal(item)

  const isLimited = item.editionType === 'limited'

  // For limited lines, the provider reserves the delta on every increase and
  // silently keeps the old quantity when stock runs out. We detect that no-op
  // and disable '+' so the buyer isn't clicking a button that does nothing.
  // setQuantity RETURNS the quantity actually achieved, so we compare that
  // against the target — never a ref read in the await-continuation, which is
  // stale before React commits the re-render.
  const [atStockCap, setAtStockCap] = useState(false)

  const increase = async () => {
    const target = item.quantity + 1
    const reached = await setQuantity(item.lineId, target)
    // Out of stock if the line never reached the quantity we asked for.
    setAtStockCap(isLimited && reached < target)
  }

  const decrease = async () => {
    setAtStockCap(false)
    await setQuantity(item.lineId, item.quantity - 1)
  }

  // Stable across renders so HoldCountdown's interval isn't torn down (and its
  // one-shot onExpire guard re-armed) on every parent re-render.
  const handleExpire = useCallback(() => {
    removeItem(item.lineId)
  }, [removeItem, item.lineId])

  return (
    <div className={styles.line}>
      <div className={styles.thumb}>
        <ProtectedImage
          src={item.thumbnailUrl}
          alt={item.title}
          width={120}
          height={120}
          style={{ height: 120, width: 'auto' }}
        />
      </div>

      <div className={styles.details}>
        <Text as="span" size="xs" className={styles.artist}>
          {item.artistName}
        </Text>
        <Text as="p" font="serif" size="lg" className={styles.title}>
          {item.title}
        </Text>

        <SpecList specs={item.specsSummary} visibleByDefault={4} />

        {isLimited && (
          <Text as="span" size="xs" className={styles.editionTag}>
            Limited edition
          </Text>
        )}

        {isLimited && item.holdExpiresAt && (
          <HoldCountdown expiresAt={item.holdExpiresAt} onExpire={handleExpire} />
        )}
      </div>

      <div className={styles.controls}>
        <Text as="span" size="sm" className={styles.unitPrice}>
          {formatEuro(unitItemCents)} each
        </Text>

        <div className={styles.stepper}>
          <Button
            variant="secondary"
            size="smallSquared"
            label="−"
            aria-label="Decrease quantity"
            disabled={item.quantity <= 1}
            onClick={decrease}
          />
          <Text as="span" size="sm" className={styles.qty} aria-live="polite">
            {item.quantity}
          </Text>
          <Button
            variant="secondary"
            size="smallSquared"
            label="+"
            aria-label="Increase quantity"
            disabled={isLimited && atStockCap}
            onClick={increase}
          />
        </div>

        <Text as="span" font="serif" size="lg" className={styles.lineTotal}>
          {formatEuro(lineItemCents)}
        </Text>

        <Button
          variant="ghost"
          size="smallSquared"
          label="Remove"
          onClick={() => removeItem(item.lineId)}
          className={styles.remove}
        />
      </div>
    </div>
  )
}
