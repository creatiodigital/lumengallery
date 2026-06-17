'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { validatePassword } from '@/lib/validation'

import styles from './ChangePasswordPage.module.scss'

export const ChangePasswordPage = () => {
  const router = useRouter()
  const { update: updateSession } = useSession()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Per-field errors (strength + match). `error` stays for server failures.
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Strength via the shared `validatePassword` (one rule, client + server) plus
  // the cross-field match check.
  const computeFieldErrors = (pw: string, confirm: string) => {
    const next: { newPassword?: string; confirmPassword?: string } = {}
    const result = validatePassword(pw)
    if (!result.valid) next.newPassword = `Password must include ${result.errors.join(', ')}.`
    if (confirm !== pw) next.confirmPassword = 'Passwords do not match.'
    return next
  }

  // House flow: errors only after the first submit, then re-checked live.
  const revalidate = (pw: string, confirm: string) => {
    if (submitAttempted) setFieldErrors(computeFieldErrors(pw, confirm))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitAttempted(true)

    const nextErrors = computeFieldErrors(newPassword, confirmPassword)
    setFieldErrors(nextErrors)
    if (nextErrors.newPassword || nextErrors.confirmPassword) return

    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to change password')
        setSubmitting(false)
        return
      }

      // Refresh session to clear mustChangePassword flag
      await updateSession({})

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Text font="dashboard" as="h1">
          Set Your Password
        </Text>
        <Text font="dashboard" as="p" className={styles.subtitle}>
          For security, please create a new password to replace the temporary one.
        </Text>

        <div className={styles.requirements}>
          <Text font="dashboard" as="p" className={styles.requirementsTitle}>
            Password requirements:
          </Text>
          <ul>
            <li>At least 8 characters</li>
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <FormField label="New Password" htmlFor="newPassword" error={fieldErrors.newPassword}>
            <Input
              id="newPassword"
              type="password"
              size="medium"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                revalidate(e.target.value, confirmPassword)
              }}
              invalid={!!fieldErrors.newPassword}
              autoComplete="new-password"
              showPasswordToggle
            />
          </FormField>

          <FormField
            label="Confirm Password"
            htmlFor="confirmPassword"
            error={fieldErrors.confirmPassword}
          >
            <Input
              id="confirmPassword"
              type="password"
              size="medium"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                revalidate(newPassword, e.target.value)
              }}
              invalid={!!fieldErrors.confirmPassword}
              autoComplete="new-password"
              showPasswordToggle
            />
          </FormField>

          <ErrorText>{error}</ErrorText>

          <Button
            font="dashboard"
            variant="primary"
            label={submitting ? 'Saving...' : 'Set Password'}
            type="submit"
          />
        </form>
      </div>
    </div>
  )
}
