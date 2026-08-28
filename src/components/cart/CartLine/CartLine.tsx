'use client'

import { useState } from 'react'

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

  // Limited editions are capped at a single copy per order: one buy → one
  // edition number, so an order never carries two or three numbers that are
  // hard to track. A buyer who wants another copy pays again. The '+' is
  // disabled for limited lines; open editions step freely.
  const isLimited = item.editionType === 'limited'

  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const increase = async () => {
    await setQuantity(item.lineId, item.quantity + 1)
  }

  const decrease = async () => {
    // At the floor, "−" means remove: confirm first (same modal as the Delete
    // CTA) rather than silently dropping the line to a 0-quantity state.
    if (item.quantity <= 1) {
      setConfirmingRemove(true)
      return
    }
    await setQuantity(item.lineId, item.quantity - 1)
  }

  // "Edit item" re-opens the wizard pre-filled with this line's selection. The
  // lineId rides along so the wizard replaces this line on re-add (rather than
  // leaving a duplicate). Encoding shared with the checkout "back to wizard".
  const editParams = configToWizardParams(item.config)
  editParams.set('editLineId', item.lineId)
  // Limited editions re-open the variant-picker wizard, which restores the
  // chosen edition from this param (the config params don't carry the variant).
  if (item.variantId) editParams.set('variant', item.variantId)
  const editHref = `/artworks/${item.artworkSlug}/print?${editParams.toString()}`

  // Open editions only. A limited line has nothing to edit — the variant IS
  // the object, not a configuration of it, and the wizard it led to could only
  // ever offer "Go to cart" or add a second line. A button labelled Edit that
  // cannot edit is worse than no button.
  //
  // Two placements, one of them always display:none (so only ever one is in
  // the accessibility tree): on phones it rides the edition line inside the
  // details, level with "Open Edition"; from sm up it stays in the price
  // panel / card corner where it has always been. They sit in different DOM
  // parents, so CSS alone can't move one between them.
  const editButton = (inline: boolean) =>
    isLimited ? null : (
      <Button
        variant="secondary"
        size={inline ? 'smallSquared' : 'regularSquared'}
        fullWidth={!inline}
        icon="square-pen"
        label="Edit Item"
        href={editHref}
      />
    )

  return (
    <div className={styles.line}>
      <div className={styles.body}>
        <CartItemDetails
          item={item}
          thumbHeight={140}
          editionAction={
            isLimited ? undefined : <span className={styles.inlineEdit}>{editButton(true)}</span>
          }
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
            disabled={isLimited}
            onClick={increase}
          />
        </div>

        <div className={styles.totalBlock}>
          <Text as="span" size="sm" className={styles.panelLabel}>
            Base price
          </Text>
          <Text as="span" font="serif" size="xl" className={styles.totalValue}>
            {formatEuro(lineItemCents)}
          </Text>
        </div>

        <div className={styles.actions}>{editButton(false)}</div>
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
