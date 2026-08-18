'use client'

import { useId } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './UnboxingReminderModal.module.scss'

type UnboxingReminderModalProps = {
  onClose: () => void
}

/**
 * Shown once on the confirmation step, right after the order is confirmed.
 *
 * Why here and not at the pay button: a blocking gate before payment adds
 * friction at the moment of purchase, and it lands ~3 weeks before the parcel
 * does — far too early to be recalled. This spot costs the buyer nothing and
 * catches them while they're still paying attention; the shipped + delivered
 * emails carry the same request when the box is actually at the door.
 *
 * The request is a suggestion, never a condition. Transit damage is the
 * seller's risk until the buyer takes possession, so a claim without footage
 * still has to be honoured — what the images actually buy us is a same-day
 * reprint decision and a claim against the carrier.
 */
export const UnboxingReminderModal = ({ onClose }: UnboxingReminderModalProps) => {
  const titleId = useId()

  return (
    <Modal onClose={onClose} titleId={titleId}>
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden>
          <Icon name="camera" size={28} />
        </span>

        <h2 id={titleId} className={styles.title}>
          A small request
        </h2>

        <Text as="p" size="md" className={styles.paragraph}>
          We kindly suggest taking a few photos, or a short video, as you unwrap your print &mdash;
          the sealed parcel first, then the moment you open it.
        </Text>
        <Text as="p" size="md" className={styles.paragraph}>
          Damage in transit is rare and your print travels well protected. But should anything
          arrive less than perfect, those images let us arrange a reprint or a refund right away,
          with no back-and-forth.
        </Text>

        <Text as="p" size="sm" className={styles.footnote}>
          We&apos;ll remind you again when your print ships.
        </Text>

        <div className={styles.actions}>
          <Button variant="primary" size="bigSquared" label="Got it" onClick={onClose} />
        </div>
      </div>
    </Modal>
  )
}
