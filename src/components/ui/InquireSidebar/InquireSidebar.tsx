'use client'

import { useState } from 'react'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Typography'
import { Modal } from '@/components/ui/Modal'
import { useFormValidation } from '@/hooks/useFormValidation'
import { email, minLength, phone, type Validator } from '@/lib/validation'

import styles from './InquireSidebar.module.scss'

type InquireSidebarProps = {
  isOpen: boolean
  onClose: () => void
  artwork: {
    slug: string
    title: string
    year?: number
    artistName: string
    imageUrl: string
  }
}

type FormErrors = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  message?: string
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

type FieldName = keyof FormErrors

// Built from the shared validator factories so the messages + rules live in
// one place. Module-level (stable identity) for `useFormValidation`.
const inquireValidators: Record<FieldName, Validator> = {
  firstName: minLength(2, 'Please enter your first name.'),
  lastName: minLength(2, 'Please enter your last name.'),
  email: email(),
  phone: phone(),
  message: minLength(10, 'Please enter a message of at least 10 characters.'),
}

export const InquireSidebar = ({ isOpen, onClose, artwork }: InquireSidebarProps) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [emailField, setEmailField] = useState('')
  const [phoneField, setPhoneField] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [showModal, setShowModal] = useState(false)

  // Shared house validation flow (silent → all errors on submit → clear live).
  const {
    validateAll,
    handleChange,
    fieldError,
    reset: resetValidation,
  } = useFormValidation(inquireValidators)

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmailField('')
    setPhoneField('')
    setMessage('')
    resetValidation()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      setSubmitStatus('success')
      setShowModal(true)
      onClose()
      return
    }

    const valid = validateAll({
      firstName,
      lastName,
      email: emailField,
      phone: phoneField,
      message,
    })
    if (!valid) return

    setSubmitStatus('submitting')

    try {
      const response = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: emailField,
          phone: phoneField,
          message,
          artworkSlug: artwork.slug,
          artworkTitle: artwork.title,
          artworkArtist: artwork.artistName,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send inquiry')
      }

      setSubmitStatus('success')
      resetForm()
      onClose()
      setShowModal(true)
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      setSubmitStatus('error')
      onClose()
      setShowModal(true)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSubmitStatus('idle')
  }

  return (
    <>
      {/* Success/Error Modal */}
      {showModal && (
        <Modal onClose={closeModal}>
          <div className={styles.modalContent}>
            {submitStatus === 'success' ? (
              <>
                <Text as="p" size="sm">
                  → Inquiry successfully sent
                </Text>
                <Text as="p" size="xs" className={styles.modalSubtext}>
                  We will respond to your inquiry shortly.
                </Text>
              </>
            ) : (
              <>
                <Text as="p" size="sm">
                  → Something went wrong
                </Text>
                <Text as="p" size="xs" className={styles.modalSubtext}>
                  Please try again later.
                </Text>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Sidebar */}
      {isOpen && (
        <div className={`${styles.backdrop} ${styles.open}`}>
          <div className={`${styles.sidebar} ${styles.open}`}>
            <div className={styles.header}>
              <Text as="h2" size="2xl" font="serif" className={styles.title}>
                Send an inquiry
              </Text>
              <Button
                variant="ghost"
                onClick={onClose}
                label="CLOSE"
                iconRight={<Icon name="close" size={16} />}
                className={styles.closeButton}
                aria-label="Close inquiry"
              />
            </div>

            <div className={styles.content}>
              <form onSubmit={handleSubmit} className={styles.form} noValidate>
                {/* Honeypot field */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className={styles.honeypot}
                  tabIndex={-1}
                  autoComplete="off"
                />

                <FormField error={fieldError('firstName')}>
                  <label htmlFor="firstName" className={styles.label}>
                    First name
                  </label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      handleChange('firstName', e.target.value)
                    }}
                    variant="underline"
                    maxLength={100}
                    invalid={!!fieldError('firstName')}
                    className={styles.input}
                  />
                </FormField>

                <FormField error={fieldError('lastName')}>
                  <label htmlFor="lastName" className={styles.label}>
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      handleChange('lastName', e.target.value)
                    }}
                    variant="underline"
                    maxLength={100}
                    invalid={!!fieldError('lastName')}
                    className={styles.input}
                  />
                </FormField>

                <FormField error={fieldError('email')}>
                  <label htmlFor="email" className={styles.label}>
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={emailField}
                    onChange={(e) => {
                      setEmailField(e.target.value)
                      handleChange('email', e.target.value)
                    }}
                    variant="underline"
                    maxLength={200}
                    invalid={!!fieldError('email')}
                    className={styles.input}
                  />
                </FormField>

                <FormField error={fieldError('phone')}>
                  <label htmlFor="phone" className={styles.label}>
                    Phone
                  </label>
                  <Input
                    id="phone"
                    value={phoneField}
                    onChange={(e) => {
                      setPhoneField(e.target.value)
                      handleChange('phone', e.target.value)
                    }}
                    variant="underline"
                    maxLength={32}
                    invalid={!!fieldError('phone')}
                    className={styles.input}
                  />
                </FormField>

                <FormField error={fieldError('message')}>
                  <label htmlFor="message" className={styles.label}>
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value)
                      handleChange('message', e.target.value)
                    }}
                    className={styles.textarea}
                    rows={4}
                    maxLength={4000}
                    aria-invalid={!!fieldError('message') || undefined}
                  />
                </FormField>

                <div className={styles.artworkPreview}>
                  <div className={styles.artworkImage}>
                    <ProtectedImage
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      width={80}
                      height={80}
                      style={{ height: 80, width: 'auto' }}
                    />
                  </div>
                  <div className={styles.artworkInfo}>
                    <Text as="p" size="sm" weight="medium" font="serif">
                      {artwork.artistName}
                    </Text>
                    <Text as="p" size="sm" font="serif">
                      <em>{artwork.title}</em>
                      {artwork.year && `, ${artwork.year}`}
                    </Text>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="bigSquared"
                  label={submitStatus === 'submitting' ? 'Sending...' : 'Send inquiry'}
                  disabled={submitStatus === 'submitting'}
                  className={styles.submitButton}
                />

                <Text as="p" size="xs" className={styles.disclaimer}>
                  In order to respond to your inquiry, we will process the personal data you have
                  supplied in accordance with our{' '}
                  <a href="/privacy-policy" className={styles.link}>
                    privacy policy
                  </a>
                  .
                </Text>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default InquireSidebar
