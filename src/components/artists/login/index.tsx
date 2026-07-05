'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ForgotPasswordModal } from '@/components/ui/ForgotPasswordModal'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { useFormValidation } from '@/hooks/useFormValidation'
import { email as emailRule, required } from '@/lib/validation'

import styles from './login.module.scss'

// Login validates email shape + presence client-side (the password field is the
// user's *existing* password, so it gets a presence check only — never the
// strength rules). Wrong-credential errors stay server-side + form-level.
const credentialValidators = {
  email: emailRule(),
  password: required('Please enter your password.'),
}
const codeValidators = {
  loginCode: required('Please enter the verification code.'),
}

export const LoginPage = () => {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  // 2FA step: 'credentials' or 'code'
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')

  const {
    validateAll: validateCredentials,
    handleChange: handleCredentialChange,
    fieldError: credentialError,
  } = useFormValidation(credentialValidators)
  const {
    validateAll: validateCode,
    handleChange: handleCodeChange,
    fieldError: codeError,
    reset: resetCode,
  } = useFormValidation(codeValidators)

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateCredentials({ email, password })) return
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/send-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid email or password')
        setSubmitting(false)
        return
      }

      // If user must change password, sign in directly (no OTP) and redirect
      if (data.mustChangePassword) {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError('Failed to sign in')
          setSubmitting(false)
          return
        }

        router.push('/dashboard/change-password')
        router.refresh()
        return
      }

      // Local-dev escape hatch: server signaled OTP is bypassed
      // (SKIP_LOGIN_OTP=true), so we sign in straight from the
      // password step without showing the 6-digit prompt.
      if (data.skipOtp) {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })
        if (result?.error) {
          setError('Failed to sign in')
          setSubmitting(false)
          return
        }
        const session = await getSession()
        const userType = session?.user?.userType
        if (userType === 'admin' || userType === 'superAdmin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/dashboard')
        }
        router.refresh()
        return
      }

      // Move to code verification step
      setStep('code')
      setSubmitting(false)
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateCode({ loginCode })) return
    setSubmitting(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        loginCode,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid or expired verification code')
        setSubmitting(false)
        return
      }

      // Get session to check user type
      const session = await getSession()

      const userType = session?.user?.userType
      if (userType === 'admin' || userType === 'superAdmin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setSuccessMessage('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/send-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        setError('')
        setLoginCode('')
        setSuccessMessage('Verification code resent!')
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        setError('Failed to resend code')
      }
    } catch {
      setError('Failed to resend code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <Text font="dashboard" as="h1">
            Sign In
          </Text>
          <Text font="dashboard" as="p" className={styles.subtitle}>
            Sign in to your account
          </Text>

          {step === 'credentials' ? (
            <form onSubmit={handleSendCode} className={styles.form} noValidate>
              <FormField label="Email" htmlFor="email" error={credentialError('email')}>
                <Input
                  id="email"
                  type="email"
                  size="medium"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    handleCredentialChange('email', e.target.value)
                  }}
                  invalid={!!credentialError('email')}
                  autoComplete="email"
                  required
                />
              </FormField>

              <FormField label="Password" htmlFor="password" error={credentialError('password')}>
                <Input
                  id="password"
                  type="password"
                  size="medium"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    handleCredentialChange('password', e.target.value)
                  }}
                  invalid={!!credentialError('password')}
                  autoComplete="current-password"
                  showPasswordToggle
                  required
                />
                <Button
                  variant="ghost"
                  className={styles.forgotLink}
                  onClick={() => setShowForgotPassword(true)}
                  label="Forgot password?"
                />
              </FormField>

              <ErrorText>{error}</ErrorText>

              <Button
                font="dashboard"
                variant="primary"
                label={submitting ? 'Signing in...' : 'Continue'}
                type="submit"
              />
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className={styles.form} noValidate>
              {/* Visually hidden credentials for Chrome password manager detection */}
              <div
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  opacity: 0,
                  height: 0,
                  overflow: 'hidden',
                }}
              >
                <input
                  type="email"
                  name="email"
                  value={email}
                  autoComplete="email"
                  readOnly
                  tabIndex={-1}
                />
                <input
                  type="password"
                  name="password"
                  value={password}
                  autoComplete="current-password"
                  readOnly
                  tabIndex={-1}
                />
              </div>

              <Text font="dashboard" as="p" className={styles.codeMessage}>
                We sent a verification code to <strong>{email}</strong>
              </Text>

              <FormField
                label="Verification Code"
                htmlFor="loginCode"
                error={codeError('loginCode')}
              >
                <Input
                  id="loginCode"
                  type="text"
                  size="medium"
                  value={loginCode}
                  onChange={(e) => {
                    setLoginCode(e.target.value)
                    handleCodeChange('loginCode', e.target.value)
                  }}
                  invalid={!!codeError('loginCode')}
                  placeholder="Enter 6-digit code"
                  autoComplete="one-time-code"
                  required
                />
              </FormField>

              <ErrorText>{error}</ErrorText>
              {successMessage && (
                <Text
                  font="dashboard"
                  as="p"
                  style={{ color: '#22c55e', fontSize: '14px', marginBottom: '8px' }}
                >
                  {successMessage}
                </Text>
              )}

              <div className={styles.codeActions}>
                <Button
                  font="dashboard"
                  variant="primary"
                  label={submitting ? 'Verifying...' : 'Sign in'}
                  type="submit"
                />
                <Button
                  variant="ghost"
                  className={styles.resendLink}
                  onClick={handleResendCode}
                  disabled={submitting}
                  label="Resend code"
                />
              </div>

              <Button
                variant="ghost"
                className={styles.backLink}
                onClick={() => {
                  setStep('credentials')
                  setLoginCode('')
                  setError('')
                  resetCode()
                }}
                label="← Back to login"
              />
            </form>
          )}
        </div>
      </div>

      {showForgotPassword && (
        <Modal onClose={() => setShowForgotPassword(false)}>
          <ForgotPasswordModal
            onClose={() => setShowForgotPassword(false)}
            onBack={() => setShowForgotPassword(false)}
          />
        </Modal>
      )}
    </>
  )
}
