'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { useFormValidation } from '@/hooks/useFormValidation'
import { email, required, validatePassword } from '@/lib/validation'

import styles from './AddArtistModal.module.scss'

// Base user types - admin option added dynamically for superAdmin
const baseUserTypeOptions = [
  { value: 'artist', label: 'Artist' },
  { value: 'curator', label: 'Curator' },
]

const addArtistValidators = {
  name: required('Please enter a first name.'),
  lastName: required('Please enter a last name.'),
  handler: required('Please enter a handler.'),
  email: email(),
  // Optional — a blank password is auto-generated server-side. But if the admin
  // types one, validate its strength here (same rules the server enforces) so
  // they get instant feedback instead of a round-trip 400.
  password: (value: string) => {
    if (!value.trim()) return undefined
    const result = validatePassword(value)
    return result.valid ? undefined : `Password must include ${result.errors.join(', ')}.`
  },
}

type AddArtistModalProps = {
  onClose: () => void
  onSuccess: () => void
  isSuperAdmin?: boolean
}

export const AddArtistModal = ({
  onClose,
  onSuccess,
  isSuperAdmin = false,
}: AddArtistModalProps) => {
  // Add admin option only for superAdmin users
  const userTypeOptions = isSuperAdmin
    ? [...baseUserTypeOptions, { value: 'admin', label: 'Admin' }]
    : baseUserTypeOptions
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    handler: '',
    email: '',
    password: '',
    userType: 'artist',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [provisionalPassword, setProvisionalPassword] = useState('')

  const {
    validateAll,
    handleChange: validateField,
    fieldError,
  } = useFormValidation(addArtistValidators)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Auto-generate handler from name and lastName
    if (field === 'name' || field === 'lastName') {
      const newName = field === 'name' ? value : formData.name
      const newLastName = field === 'lastName' ? value : formData.lastName
      const handler = `${newName}-${newLastName}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/--+/g, '-')
      setFormData((prev) => ({ ...prev, handler, [field]: value }))
    }

    // Live-clear validation errors for the validated fields (the `if` also
    // narrows the type to the schema keys).
    if (
      field === 'name' ||
      field === 'lastName' ||
      field === 'handler' ||
      field === 'email' ||
      field === 'password'
    ) {
      validateField(field, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const valid = validateAll({
      name: formData.name,
      lastName: formData.lastName,
      handler: formData.handler,
      email: formData.email,
      password: formData.password,
    })
    if (!valid) return

    setLoading(true)

    try {
      const response = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create artist')
        setLoading(false)
        return
      }

      // If provisional password was generated, show it
      if (data.provisionalPassword) {
        setProvisionalPassword(data.provisionalPassword)
        return // Don't close modal yet, show the password
      }

      onSuccess()
      onClose()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className={styles.modal}>
      {provisionalPassword ? (
        <>
          <Text font="dashboard" as="h2">
            User Created Successfully
          </Text>
          <div className={styles.section}>
            <Text font="dashboard" as="p" style={{ marginBottom: '16px' }}>
              The following temporary password was generated. Please share it with the artist:
            </Text>
            <div className={styles.provisionalPassword}>
              <code>{provisionalPassword}</code>
            </div>
            <Text
              font="dashboard"
              as="p"
              style={{ fontSize: '13px', color: '#666', marginTop: '12px' }}
            >
              The artist will be asked to set a new password on their first login.
            </Text>
          </div>
          <div className={styles.actions}>
            <Button
              font="dashboard"
              variant="primary"
              label="Done"
              onClick={() => {
                onSuccess()
                onClose()
              }}
            />
          </div>
        </>
      ) : (
        <>
          <Text font="dashboard" as="h2">
            Add New User
          </Text>
          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            <div className={styles.section}>
              <label className={styles.label} htmlFor="name">
                First Name
              </label>
              <Input
                id="name"
                type="text"
                size="medium"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                invalid={!!fieldError('name')}
                required
              />
              <ErrorText>{fieldError('name')}</ErrorText>

              <label className={styles.label} htmlFor="lastName">
                Last Name
              </label>
              <Input
                id="lastName"
                type="text"
                size="medium"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                invalid={!!fieldError('lastName')}
                required
              />
              <ErrorText>{fieldError('lastName')}</ErrorText>

              <label className={styles.label} htmlFor="handler">
                Handler (URL slug)
              </label>
              <Input
                id="handler"
                type="text"
                size="medium"
                value={formData.handler}
                onChange={(e) => handleChange('handler', e.target.value)}
                invalid={!!fieldError('handler')}
                required
              />
              <ErrorText>{fieldError('handler')}</ErrorText>

              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                size="medium"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                invalid={!!fieldError('email')}
                autoComplete="off"
                required
              />
              <ErrorText>{fieldError('email')}</ErrorText>

              <label className={styles.label} htmlFor="password">
                Password{' '}
                <span style={{ fontWeight: 'normal', fontSize: '12px', color: '#888' }}>
                  (optional — auto-generated if empty)
                </span>
              </label>
              <Input
                id="password"
                type="password"
                size="medium"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                autoComplete="new-password"
                showPasswordToggle
                invalid={!!fieldError('password')}
              />
              <ErrorText>{fieldError('password')}</ErrorText>

              <label className={styles.label} htmlFor="userType">
                Type
              </label>
              <Select
                options={userTypeOptions}
                value={formData.userType}
                onChange={(val) => handleChange('userType', val as string)}
                size="medium"
              />
            </div>

            <ErrorText>{error}</ErrorText>

            <div className={styles.actions}>
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={onClose}
                type="button"
              />
              <Button
                font="dashboard"
                variant="primary"
                label={loading ? 'Creating...' : 'Create User'}
                type="submit"
              />
            </div>
          </form>
        </>
      )}
    </div>
  )
}
