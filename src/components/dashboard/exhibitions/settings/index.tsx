'use client'

import { useEffect, useState, useCallback } from 'react'

import { slugify } from '@/utils/slugify'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

import { Text } from '@/components/ui/Typography'

import { DashboardLayout } from '../../DashboardLayout'
import dashboardStyles from '../../DashboardLayout/DashboardLayout.module.scss'
import styles from './ExhibitionSettings.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  description: string | null
  shortDescription: string | null
  featuredImageUrl: string | null
  url: string
  userId: string
  status: string

  startDate: string | null
  endDate: string | null
  user?: {
    handler: string
  }
}

interface ExhibitionSettingsPageProps {
  exhibitionId: string
}

export const ExhibitionSettingsPage = ({ exhibitionId }: ExhibitionSettingsPageProps) => {
  const [exhibition, setExhibition] = useState<Exhibition | null>(null)
  const [mainTitle, setMainTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shortDescription, setShortDescription] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [urlError, setUrlError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch exhibition data
  useEffect(() => {
    const fetchExhibition = async () => {
      try {
        const response = await fetch(`/api/exhibitions/${exhibitionId}`)
        if (!response.ok) {
          setError('Exhibition not found')
          return
        }
        const data = await response.json()
        setExhibition(data)
        setMainTitle(data.mainTitle || '')
        setCustomUrl(data.url || '')
        setDescription(data.description || '')
        setShortDescription(data.shortDescription || '')
      } catch {
        setError('Failed to load exhibition')
      } finally {
        setLoading(false)
      }
    }

    if (exhibitionId) {
      fetchExhibition()
    }
  }, [exhibitionId])

  const handleSaveName = useCallback(async () => {
    if (!exhibition || !mainTitle.trim()) return

    const newUrl = customUrl.trim() ? slugify(customUrl) : slugify(mainTitle)
    // Skip check if URL hasn't changed
    if (newUrl !== exhibition.url) {
      // Check uniqueness
      setSavingName(true)
      try {
        const checkResponse = await fetch(
          `/api/exhibitions/check-url?userId=${exhibition.userId}&url=${encodeURIComponent(newUrl)}&excludeId=${exhibition.id}`,
        )
        const checkData = await checkResponse.json()
        if (!checkData.available) {
          setUrlError('An exhibition with this name already exists.')
          setSavingName(false)
          return
        }
      } catch {
        // Continue — server-side will catch it
      }
    }

    setSavingName(true)
    setUrlError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainTitle, url: customUrl.trim() || undefined }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 409) {
          setUrlError(data.error || 'An exhibition with this name already exists.')
        } else {
          setError(data.error || 'Failed to save name')
        }
        return
      }

      // Update local exhibition state with new name/url
      const finalUrl = customUrl.trim() ? slugify(customUrl) : slugify(mainTitle)
      setExhibition((prev) => (prev ? { ...prev, mainTitle, url: finalUrl } : prev))
      setCustomUrl(finalUrl)
      setEditingName(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to save name')
    } finally {
      setSavingName(false)
    }
  }, [exhibition, mainTitle, customUrl])

  const handleCancelEditName = useCallback(() => {
    setMainTitle(exhibition?.mainTitle || '')
    setCustomUrl(exhibition?.url || '')
    setUrlError('')
    setEditingName(false)
  }, [exhibition])

  const handleSave = useCallback(async () => {
    if (!exhibition) return

    setSaving(true)
    setSaveSuccess(false)
    setError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, shortDescription }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to save')
        return
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [exhibition, description, shortDescription])

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!exhibition) return

      setUploading(true)
      setError('')

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/exhibitions/${exhibition.id}/image`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to upload image')
          setUploading(false)
          return
        }

        const data = await response.json()
        setExhibition((prev) => (prev ? { ...prev, featuredImageUrl: data.url } : prev))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch {
        setError('Failed to upload image')
      } finally {
        setUploading(false)
      }
    },
    [exhibition],
  )

  const handleRemoveImage = useCallback(async () => {
    if (!exhibition?.featuredImageUrl) return

    setUploading(true)
    setError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setError('Failed to remove image')
        setUploading(false)
        return
      }

      setExhibition((prev) => (prev ? { ...prev, featuredImageUrl: null } : prev))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [exhibition])

  if (loading) {
    return <DashboardLayout backLink="/dashboard">Loading...</DashboardLayout>
  }

  if (error && !exhibition) {
    return (
      <DashboardLayout backLink="/dashboard">
        <ErrorText>{error}</ErrorText>
      </DashboardLayout>
    )
  }

  if (!exhibition) {
    return (
      <DashboardLayout backLink="/dashboard">
        <ErrorText>Exhibition not found</ErrorText>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout backLink="/dashboard">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Exhibition Settings</h1>

      {/* Exhibition Name Section */}
      <div className={dashboardStyles.section}>
        <h3 className={dashboardStyles.sectionTitle}>Exhibition Name</h3>
        <p className={dashboardStyles.sectionDescription}>
          The name of your exhibition. This also determines the URL slug.
        </p>
        <Input
          type="text"
          value={mainTitle}
          onChange={(e) => setMainTitle(e.target.value)}
          placeholder="Exhibition name"
          inputClassName={styles.titleInput}
          readOnly={!editingName}
          invalid={!!urlError}
          aria-label="Exhibition name"
        />
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)' }}>
          {!editingName ? (
            <Button
              font="dashboard"
              variant="secondary"
              label="Edit Exhibition Name"
              onClick={() => setEditingName(true)}
            />
          ) : (
            <>
              <Button
                font="dashboard"
                variant="primary"
                label={savingName ? 'Saving...' : 'Save Name'}
                onClick={handleSaveName}
                disabled={savingName || !mainTitle.trim()}
              />
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={handleCancelEditName}
                disabled={savingName}
              />
            </>
          )}
        </div>
        {urlError && <ErrorText>{urlError}</ErrorText>}
        {editingName && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <label
              className={dashboardStyles.sectionDescription}
              style={{ display: 'block', marginBottom: 'var(--space-1)' }}
            >
              Custom URL slug (optional)
            </label>
            <Input
              type="text"
              value={customUrl}
              onChange={(e) =>
                setCustomUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder={slugify(mainTitle)}
              inputClassName={styles.titleInput}
              invalid={!!urlError}
              aria-label="Custom URL slug"
            />
            <span className={dashboardStyles.hint}>
              Leave empty to auto-generate from title. Only lowercase letters, numbers, and dashes.
            </span>
          </div>
        )}
        <span className={dashboardStyles.hint}>
          URL: {exhibition.user?.handler || 'artist'}/
          {customUrl || slugify(mainTitle) || exhibition.url}
        </span>
      </div>

      {/* Featured Image Section */}
      <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
        <h3 className={dashboardStyles.sectionTitle}>Featured Image</h3>
        <p className={dashboardStyles.sectionDescription}>
          The main image for your exhibition. This will be displayed on exhibition listings and as a
          cover.
        </p>
        <ImageUploader
          imageUrl={exhibition.featuredImageUrl}
          onUpload={handleImageUpload}
          onRemove={handleRemoveImage}
          uploading={uploading}
          aspectRatio="16 / 10"
        />
        <span className={dashboardStyles.hint}>Recommended: JPG, PNG, or WebP. Max 1MB.</span>
      </div>

      <div className={dashboardStyles.section}>
        <h3 className={dashboardStyles.sectionTitle}>Short Description</h3>
        <p className={dashboardStyles.sectionDescription}>
          A brief summary shown on exhibition listings. Max 400 characters.
        </p>
        <textarea
          value={shortDescription}
          onChange={(e) => {
            if (e.target.value.length <= 400) setShortDescription(e.target.value)
          }}
          placeholder="Write a short description..."
          className={styles.shortDescriptionInput}
          rows={3}
          maxLength={400}
        />
        <span className={dashboardStyles.hint}>{shortDescription.length}/400 characters</span>
      </div>

      <div className={dashboardStyles.section}>
        <h3 className={dashboardStyles.sectionTitle}>Description</h3>
        <p className={dashboardStyles.sectionDescription}>
          Tell visitors about this exhibition. Supports rich text formatting.
        </p>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder="Write a description for your exhibition..."
        />
        <span className={dashboardStyles.hint}>
          A compelling description helps attract visitors to your exhibition.
        </span>
      </div>

      <div className={dashboardStyles.actions}>
        <Button
          font="dashboard"
          variant="primary"
          label={saving ? 'Saving...' : 'Save'}
          onClick={handleSave}
          disabled={saving}
        />
        {saveSuccess && (
          <Text font="dashboard" as="span" className={styles.successMessage}>
            Saved!
          </Text>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
    </DashboardLayout>
  )
}
