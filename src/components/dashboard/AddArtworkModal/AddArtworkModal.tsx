'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'

import dashboardStyles from '../DashboardLayout/DashboardLayout.module.scss'
import styles from './AddArtworkModal.module.scss'

const artworkTypeOptions = [
  { value: 'image', label: 'Image' },
  { value: 'text', label: 'Text' },
  { value: 'sound', label: 'Sound' },
  { value: 'video', label: 'Video' },
]

type AddArtworkModalProps = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export const AddArtworkModal = ({ userId, onClose, onSuccess }: AddArtworkModalProps) => {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    artworkType: 'image',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: formData.title,
          artworkType: formData.artworkType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to create artwork')
        setLoading(false)
        return
      }

      const artwork = await response.json()

      onSuccess()
      onClose()

      // Redirect to edit page
      router.push(`/dashboard/artworks/${artwork.id}/edit`)
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className={styles.modal}>
      <Text font="dashboard" as="h2">
        Add New Artwork
      </Text>
      <form onSubmit={handleSubmit} noValidate>
        {/* Title Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Title</h3>
          <p className={dashboardStyles.sectionDescription}>
            Give your artwork a name. You can change this later.
          </p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g. Sunset Painting"
          />
          <span className={dashboardStyles.hint}>Leave empty to auto-generate a title.</span>
        </div>

        {/* Type Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Type</h3>
          <p className={dashboardStyles.sectionDescription}>
            Choose the type of artwork you want to create.
          </p>
          <Select
            options={artworkTypeOptions}
            value={formData.artworkType}
            onChange={(val) => handleChange('artworkType', val as string)}
            size="medium"
          />
          <span className={dashboardStyles.hint}>
            Image for visual artworks, Text for written content, Sound for audio, Video for video
            artworks.
          </span>
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
            label={loading ? 'Creating...' : 'Create Artwork'}
            type="submit"
          />
        </div>
      </form>
    </div>
  )
}
