'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import { validatePassword } from '@/lib/validation'

import styles from './reset-password.module.scss'

const ResetPasswordForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Per-field errors (password strength + match). `error` stays for
  // form-level problems (invalid token, server failure).
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>(
    {},
  )
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
    }
  }, [token])

  // Strength via the shared `validatePassword` (one rule, client + server) plus
  // the cross-field match check.
  const computeFieldErrors = (pw: string, confirm: string) => {
    const next: { password?: string; confirmPassword?: string } = {}
    const result = validatePassword(pw)
    if (!result.valid) next.password = `Password must include ${result.errors.join(', ')}.`
    if (confirm !== pw) next.confirmPassword = 'Passwords do not match.'
    return next
  }

  // House flow: errors only after the first submit, then re-checked live as the
  // user edits either field (so the match error clears once they line up).
  const revalidate = (pw: string, confirm: string) => {
    if (submitAttempted) setFieldErrors(computeFieldErrors(pw, confirm))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitAttempted(true)

    const nextErrors = computeFieldErrors(password, confirmPassword)
    setFieldErrors(nextErrors)
    if (nextErrors.password || nextErrors.confirmPassword) return

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
        setLoading(false)
        return
      }

      setSuccess(true)
      // Redirect to home after 3 seconds
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.container}>
        <Text as="h1" size="2xl" font="serif" className={styles.title}>
          Password Reset Successfully
        </Text>
        <Text as="p" className={styles.subtitle}>
          Your password has been updated. You can now log in with your new password.
        </Text>
        <Text as="p" className={styles.redirect}>
          Redirecting to home page...
        </Text>
        <Link href="/" className={styles.link}>
          Go to Home
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Text as="h1" size="2xl" font="serif" className={styles.title}>
        Reset Your Password
      </Text>
      <Text as="p" className={styles.subtitle}>
        Enter your new password below.
      </Text>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <FormField label="New Password" htmlFor="password" error={fieldErrors.password}>
          <Input
            id="password"
            type="password"
            size="medium"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              revalidate(e.target.value, confirmPassword)
            }}
            invalid={!!fieldErrors.password}
            showPasswordToggle
            required
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
              revalidate(password, e.target.value)
            }}
            invalid={!!fieldErrors.confirmPassword}
            showPasswordToggle
            required
          />
        </FormField>

        <ErrorText>{error}</ErrorText>

        <Button
          variant="primary"
          size="regularSquared"
          label={loading ? 'Resetting...' : 'Reset Password'}
          type="submit"
          className={styles.submitButton}
        />
      </form>

      <Link href="/" className={styles.link}>
        Back to Home
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <PageLayout>
      <Suspense fallback={<LoadingBar />}>
        <ResetPasswordForm />
      </Suspense>
    </PageLayout>
  )
}
