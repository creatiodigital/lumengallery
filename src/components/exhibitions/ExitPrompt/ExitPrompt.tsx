'use client'

import { useId } from 'react'

import Monogram from '@/icons/monogram.svg'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

import styles from './ExitPrompt.module.scss'

interface ExitPromptProps {
  open: boolean
  /** Confirmed — actually leave the exhibition. */
  onLeave: () => void
  /** Dismissed — stay exactly where the visitor is standing. */
  onCancel: () => void
}

/**
 * Confirmation shown before a visitor leaves an exhibition — raised both by the
 * corner close button and by walking out through the entrance corridor.
 *
 * The walk-out path is why this exists: someone can reach the exit threshold by
 * accident (a stray back-step on arrival), so leaving is always a decision
 * rather than a consequence of where they wandered. Cancelling returns them to
 * the exact spot they were standing.
 *
 * Built on the shared `Modal` primitive, which owns the backdrop, Escape,
 * focus trapping and focus restore. Not `ConfirmModal`, only because the
 * monogram sits above the title and that preset renders title-first.
 */
export const ExitPrompt = ({ open, onLeave, onCancel }: ExitPromptProps) => {
  const titleId = useId()

  if (!open) return null

  return (
    <Modal onClose={onCancel} titleId={titleId}>
      <div className={styles.body}>
        <Monogram className={styles.monogram} aria-hidden />

        <h2 id={titleId} className={styles.title}>
          Leave the exhibition?
        </h2>
        <p className={styles.message}>
          If you choose to stay, you&apos;ll begin again from the entrance.
        </p>

        <div className={styles.actions}>
          <Button variant="secondary" size="regularSquared" label="Stay" onClick={onCancel} />
          <Button variant="primary" size="regularSquared" label="Leave" onClick={onLeave} />
        </div>
      </div>
    </Modal>
  )
}

export default ExitPrompt
