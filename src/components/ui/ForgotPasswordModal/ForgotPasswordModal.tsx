'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { useFormValidation } from '@/hooks/useFormValidation'
import { email } from '@/lib/validation'

import styles from './ForgotPasswordModal.module.scss'

type ForgotPasswordModalProps = {
  onClose: () => void
  onBack: () => void
}

const forgotValidators = { email: email() }

export const ForgotPasswordModal = ({ onClose, onBack }: ForgotPasswordModalProps) => {
  const [emailField, setEmailField] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const { validateAll, handleChange, fieldError } = useFormValidation(forgotValidators)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateAll({ email: emailField })) return

    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailField }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.modal}>
        <Text as="h2">Check Your Email</Text>
        <Text as="p" className={styles.successText}>
          If an account exists with that email, we&apos;ve sent you a link to reset your password.
        </Text>
        <Text as="p" className={styles.hint}>
          Don&apos;t see it? Check your spam folder.
        </Text>
        <div className={styles.actions}>
          <Button size="small" label="Close" onClick={onClose} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.modal}>
      <Text as="h2">Forgot Password</Text>
      <Text as="p" className={styles.description}>
        Enter your email address and we&apos;ll send you a link to reset your password.
      </Text>
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          className={styles.field}
          label="Email"
          htmlFor="forgot-email"
          error={fieldError('email')}
        >
          <Input
            id="forgot-email"
            type="email"
            size="medium"
            value={emailField}
            onChange={(e) => {
              setEmailField(e.target.value)
              handleChange('email', e.target.value)
            }}
            invalid={!!fieldError('email')}
            required
          />
        </FormField>
        <ErrorText>{error}</ErrorText>
        <div className={styles.actions}>
          <Button size="small" label={loading ? 'Sending...' : 'Send Reset Link'} type="submit" />
          <Button
            size="small"
            variant="secondary"
            label="Back to Login"
            onClick={onBack}
            type="button"
          />
        </div>
      </form>
    </div>
  )
}

export default ForgotPasswordModal
