'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './SavePresetModal.module.scss'

type SavePresetModalProps = {
  onSave: (name: string) => void
  onClose: () => void
  loading: boolean
  existingNames?: string[]
}

const SavePresetModal = ({
  onSave,
  onClose,
  loading,
  existingNames = [],
}: SavePresetModalProps) => {
  const [name, setName] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const trimmed = name.trim()
  const isDuplicate =
    trimmed.length > 0 && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
  // Duplicate shows live; the empty-name error appears only after a submit
  // attempt and clears live once the user types.
  const nameError = isDuplicate
    ? 'This preset already exists'
    : submitAttempted && !trimmed
      ? 'Please enter a preset name.'
      : undefined

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (trimmed && !isDuplicate) {
      onSave(trimmed)
    }
  }

  return (
    <Modal onClose={onClose}>
      <Text font="dashboard" as="h3" size="sm" weight="bold" className={styles.title}>
        Create Preset
      </Text>
      <form onSubmit={handleSubmit} noValidate>
        <FormField className={styles.inputGroup} error={nameError}>
          <Text font="dashboard" as="label" size="xs" className={styles.label}>
            Preset name
          </Text>
          <Input
            autoFocus
            type="text"
            inputClassName={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Photography Standard"
            invalid={!!nameError}
          />
        </FormField>
        <div className={styles.actions}>
          <Button
            font="dashboard"
            size="small"
            variant="secondary"
            label="Cancel"
            onClick={onClose}
          />
          <Button
            font="dashboard"
            size="small"
            variant="primary"
            type="submit"
            label={loading ? 'Saving...' : 'Save'}
            disabled={isDuplicate || loading}
          />
        </div>
      </form>
    </Modal>
  )
}

export default SavePresetModal
