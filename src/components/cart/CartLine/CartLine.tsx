'use client'

import { useCallback, useState } from 'react'

import { CartItemDetails } from '@/components/cart/CartItemDetails/CartItemDetails'
import { configToWizardParams } from '@/components/PrintWizard/wizardParams'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal'
import { Text } from '@/components/ui/Typography'
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
  const { lineItemCents } = lineTotal(item)

  const isLimited = item.editionType === 'limited'

  // For limited lines, the provider reserves the delta on every increase and
  // silently keeps the old quantity when stock runs out. We detect that no-op
  // and disable '+' so the buyer isn't clicking a button that does nothing.
  // setQuantity RETURNS the quantity actually achieved, so we compare that
  // against the target — never a ref read in the await-continuation, which is
  // stale before React commits the re-render.
  const [atStockCap, setAtStockCap] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const increase = async () => {
    const target = item.quantity + 1
    const reached = await setQuantity(item.lineId, target)
    setAtStockCap(isLimited && reached < target)
  }

  const decrease = async () => {
    // At the floor, "−" means remove: confirm first (same modal as the Delete
    // CTA) rather than silently dropping the line to a 0-quantity state.
    if (item.quantity <= 1) {
      setConfirmingRemove(true)
      return
    }
    setAtStockCap(false)
    await setQuantity(item.lineId, item.quantity - 1)
  }

  // Stable across renders so HoldCountdown's interval isn't torn down (and its
  // one-shot onExpire guard re-armed) on every parent re-render.
  const handleExpire = useCallback(() => {
    removeItem(item.lineId)
  }, [removeItem, item.lineId])

  // "Edit item" re-opens the wizard pre-filled with this line's selection. The
  // lineId rides along so the wizard replaces this line on re-add (rather than
  // leaving a duplicate). Encoding shared with the checkout "back to wizard".
  const editParams = configToWizardParams(item.config)
  editParams.set('editLineId', item.lineId)
  const editHref = `/artworks/${item.artworkSlug}/print?${editParams.toString()}`

  return (
    <div className={styles.line}>
      <div className={styles.body}>
        <CartItemDetails
          item={item}
          thumbHeight={140}
          specsVisible={4}
          onHoldExpire={handleExpire}
        />
      </div>

      <div className={styles.panel}>
        <div className={styles.stepper}>
          <Button
            variant="secondary"
            size="smallSquared"
            icon={item.quantity <= 1 ? 'trash-2' : undefined}
            label={item.quantity <= 1 ? undefined : '−'}
            aria-label={item.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
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

        <div className={styles.totalBlock}>
          <Text as="span" size="sm" className={styles.panelLabel}>
            Total Price
          </Text>
          <Text as="span" font="serif" size="xl" className={styles.totalValue}>
            {formatEuro(lineItemCents)}
          </Text>
        </div>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="regularSquared"
            fullWidth
            icon="square-pen"
            label="Edit Item"
            href={editHref}
          />
        </div>
      </div>

      {confirmingRemove && (
        <ConfirmModal
          title="Remove print?"
          message={`Remove “${item.title}” from your cart?`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            removeItem(item.lineId)
            setConfirmingRemove(false)
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  )
}
