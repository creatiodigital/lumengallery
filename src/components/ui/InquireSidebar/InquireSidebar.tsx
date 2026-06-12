'use client'

import { useState } from 'react'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Typography'
import { Modal } from '@/components/ui/Modal'

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateField = (field: FieldName, value: string): string | undefined => {
  const trimmed = value.trim()
  switch (field) {
    case 'firstName':
      if (trimmed.length < 2) return 'Please enter your first name.'
      return
    case 'lastName':
      if (trimmed.length < 2) return 'Please enter your last name.'
      return
    case 'email':
      if (!emailRegex.test(trimmed)) return 'Please enter a valid email address.'
      return
    case 'phone': {
      const digits = trimmed.replace(/\D/g, '')
      if (digits.length < 8) return 'Please enter a valid phone number.'
      if (/^(\d)\1+$/.test(digits)) return 'Please enter a valid phone number.'
      return
    }
    case 'message':
      if (trimmed.length < 10) return 'Please enter a message of at least 10 characters.'
      return
  }
}

export const InquireSidebar = ({ isOpen, onClose, artwork }: InquireSidebarProps) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [showModal, setShowModal] = useState(false)

  // After a failed submit, re-validate a field as the user edits it so
  // the error clears in place. Per project rule, no validation runs
  // before the first submit attempt.
  const handleChange = (field: FieldName, value: string) => {
    if (!submitAttempted) return
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }))
  }

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setMessage('')
    setErrors({})
    setSubmitAttempted(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      setSubmitStatus('success')
      setShowModal(true)
      onClose()
      return
    }

    setSubmitAttempted(true)
    const newErrors: FormErrors = {
      firstName: validateField('firstName', firstName),
      lastName: validateField('lastName', lastName),
      email: validateField('email', email),
      phone: validateField('phone', phone),
      message: validateField('message', message),
    }
    setErrors(newErrors)
    if (Object.values(newErrors).some((err) => err !== undefined)) return

    setSubmitStatus('submitting')

    try {
      const response = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
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
              <form onSubmit={handleSubmit} className={styles.form}>
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

                <div className={styles.field}>
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
                    className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
                  />
                  {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                </div>

                <div className={styles.field}>
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
                    className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
                  />
                  {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                </div>

                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      handleChange('email', e.target.value)
                    }}
                    variant="underline"
                    maxLength={200}
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </div>

                <div className={styles.field}>
                  <label htmlFor="phone" className={styles.label}>
                    Phone
                  </label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      handleChange('phone', e.target.value)
                    }}
                    variant="underline"
                    maxLength={32}
                    className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                  />
                  {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                </div>

                <div className={styles.field}>
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
                    className={`${styles.textarea} ${errors.message ? styles.textareaError : ''}`}
                    rows={4}
                    maxLength={4000}
                  />
                  {errors.message && <span className={styles.errorText}>{errors.message}</span>}
                </div>

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
