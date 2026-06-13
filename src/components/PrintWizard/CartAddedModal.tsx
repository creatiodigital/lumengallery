'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

import styles from './PrintWizard.module.scss'

type Props = {
  /** Dismiss the modal and stay in the wizard. */
  onClose: () => void
  /** Leave the wizard to keep browsing (typically back to the prints page). */
  onContinueShopping: () => void
}

/**
 * Brief confirmation shown after a successful add-to-cart, with the two natural
 * next steps: keep browsing or go to the cart.
 */
export const CartAddedModal = ({ onClose, onContinueShopping }: Props) => (
  <Modal onClose={onClose} titleId="cart-added-title">
    <div className={styles.cartAddedModal}>
      <p id="cart-added-title" className={styles.cartAddedTitle}>
        Item successfully added to your cart.
      </p>
      <div className={styles.cartAddedActions}>
        <Button variant="secondary" label="Continue shopping" onClick={onContinueShopping} />
        <Button variant="primary" label="Go to cart" href="/cart" />
      </div>
    </div>
  </Modal>
)
