'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useDispatch } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Icon } from '@/components/ui/Icon'
import { closeArtworkEditModal } from '@/redux/slices/wallViewSlice'
import { editArtwork } from '@/redux/slices/artworkSlice'
import {
  ArtworkEditForm,
  getInitialFormData,
  populateFormData,
} from '@/components/shared/ArtworkEditForm'
import type { Artwork, ArtworkFormData } from '@/components/shared/ArtworkEditForm'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'

import styles from './ArtworkEditModal.module.scss'

type OriginalInfo = {
  width: number | null
  height: number | null
  originalImageUrl: string | null
  format: string | null
  sizeBytes: number | null
}

const EMPTY_ORIGINAL_INFO: OriginalInfo = {
  width: null,
  height: null,
  originalImageUrl: null,
  format: null,
  sizeBytes: null,
}

type ArtworkEditModalProps = {
  artworkId: string
}

export const ArtworkEditModal = ({ artworkId }: ArtworkEditModalProps) => {
  const { data: session } = useSession()
  const dispatch = useDispatch()

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  // Deferred image upload, identical to the dashboard media library: the
  // selected file is previewed locally and only uploaded — through the
  // high-res print-master pipeline (/api/upload/image) — when the artist
  // saves. This keeps the 2D-canvas replace and the library replace behaving
  // exactly the same (original → R2, web-optimized WebP everywhere).
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingImageRemoval, setPendingImageRemoval] = useState(false)
  const [soundUrl, setSoundUrl] = useState<string | null>(null)
  const [soundUploading, setSoundUploading] = useState(false)
  const [formData, setFormData] = useState<ArtworkFormData>(getInitialFormData())
  // Original (print-master) image metadata. The shared form reads these to
  // run the print-resolution check; without them it falls back to the
  // web-optimized image dimensions and wrongly reports the file as too small.
  const [imageDpi, setImageDpi] = useState<number | null>(null)
  const [originalInfo, setOriginalInfo] = useState<OriginalInfo>(EMPTY_ORIGINAL_INFO)

  // Fetch artwork
  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        const response = await fetch(`/api/artworks/${artworkId}`)
        if (!response.ok) {
          setError('Artwork not found')
          return
        }
        const data = await response.json()

        // Verify ownership (allow admin and superAdmin to edit any artwork)
        const userType = session?.user?.userType
        const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
        if (data.userId !== session?.user?.id && !isAdminOrAbove) {
          dispatch(closeArtworkEditModal())
          return
        }

        setArtwork(data)
        setImageUrl(data.imageUrl)
        setImageDpi(data.originalDpi ?? null)
        setOriginalInfo({
          width: data.originalWidth ?? null,
          height: data.originalHeight ?? null,
          originalImageUrl: data.originalImageUrl ?? null,
          format: data.originalFormat ?? null,
          sizeBytes: data.originalSizeBytes ?? null,
        })
        setSoundUrl(data.soundUrl || null)
        setFormData(populateFormData(data))
      } catch {
        setError('Failed to load artwork')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchArtwork()
    }
  }, [artworkId, session?.user?.id, session?.user?.userType, dispatch])

  // Revoke the local preview blob on unmount / when it changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrintOptionsChange = (next: PrintRestrictions | null) => {
    setFormData((prev) => {
      // Keep recommendations consistent: drop any paper that was just vetoed.
      const allowedPapers = next?.allowed?.paper
      const currentRecs = prev.printRecommendations?.paper ?? []
      const filteredRecs =
        allowedPapers && currentRecs.length > 0
          ? currentRecs.filter((id) => allowedPapers.includes(id))
          : currentRecs
      const printRecommendations =
        filteredRecs.length === currentRecs.length
          ? prev.printRecommendations
          : filteredRecs.length === 0
            ? null
            : { paper: filteredRecs }
      return { ...prev, printOptions: next, printRecommendations }
    })
  }

  const handlePrintRecommendationsChange = (next: PrintRecommendations | null) => {
    setFormData((prev) => ({ ...prev, printRecommendations: next }))
  }

  const handleClose = () => {
    dispatch(closeArtworkEditModal())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    setError('')

    try {
      // The image URL after any pending upload/removal resolves.
      let nextImageUrl = imageUrl

      // Step 1: a freshly chosen file → high-res print-master upload, byte-for
      // -byte the same flow as the dashboard media library (presigned PUT of
      // the original to R2, then server-side WebP generation + metadata).
      if (pendingFile) {
        const requestRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'request-upload',
            artworkId,
            contentType: pendingFile.type,
            fileSize: pendingFile.size,
          }),
        })
        if (!requestRes.ok) {
          const data = await requestRes.json()
          setError(data.error || 'Failed to prepare upload')
          setSaving(false)
          return
        }
        const { presignedUrl, originalKey } = await requestRes.json()

        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: pendingFile,
          headers: { 'Content-Type': pendingFile.type },
        })
        if (!uploadRes.ok) {
          setError('Failed to upload image to storage')
          setSaving(false)
          return
        }

        const completeRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'complete', artworkId, originalKey }),
        })
        const result = await completeRes.json()
        if (!completeRes.ok) {
          setError(result.error || 'Failed to process image')
          setSaving(false)
          return
        }

        nextImageUrl = result.imageUrl
        setImageUrl(result.imageUrl)
        setImageDpi(result.originalDpi ?? null)
        setOriginalInfo({
          width: result.originalWidth ?? null,
          height: result.originalHeight ?? null,
          originalImageUrl: result.originalImageUrl ?? null,
          format: result.originalFormat ?? null,
          sizeBytes: result.originalSizeBytes ?? null,
        })
        setPendingFile(null)
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
        }
      }
      // Step 1b: image marked for removal (and no replacement chosen).
      else if (pendingImageRemoval && imageUrl) {
        const deleteResponse = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'DELETE',
        })
        if (!deleteResponse.ok) {
          const data = await deleteResponse.json()
          setError(data.error || 'Failed to remove image')
          setSaving(false)
          return
        }
        nextImageUrl = null
        setImageUrl(null)
        setImageDpi(null)
        setOriginalInfo(EMPTY_ORIGINAL_INFO)
        setPendingImageRemoval(false)
      }

      // Step 2: transform the euros-string the UI tracks into the cents-integer
      // the PUT route expects (raw formData would drop the price).
      const { printPriceEuros, ...rest } = formData
      const parsed = Number(printPriceEuros)
      const printPriceCents =
        printPriceEuros.trim() === '' || !Number.isFinite(parsed) || parsed < 0
          ? null
          : Math.round(parsed * 100)
      const payload = { ...rest, printPriceCents }

      const response = await fetch(`/api/artworks/${artworkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update artwork')
        setSaving(false)
        return
      }

      // Update Redux state to reflect the saved changes
      // Map form field names to TArtwork property names
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'artworkTitle',
          value: formData.title,
        }),
      )
      dispatch(
        editArtwork({ currentArtworkId: artworkId, property: 'author', value: formData.author }),
      )
      dispatch(
        editArtwork({ currentArtworkId: artworkId, property: 'artworkYear', value: formData.year }),
      )
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'artworkDimensions',
          value: formData.dimensions,
        }),
      )
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'technique',
          value: formData.technique,
        }),
      )
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'description',
          value: formData.description,
        }),
      )
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'textContent',
          value: formData.textContent,
        }),
      )
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'featured',
          value: formData.featured,
        }),
      )
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'imageUrl',
          value: nextImageUrl || undefined,
        }),
      )

      // Close the modal
      dispatch(closeArtworkEditModal())
    } catch {
      setError('Something went wrong')
      setSaving(false)
    }
  }

  // Store the file locally and preview it; the actual upload happens on save.
  // For TIFFs the uploader supplies a pre-decoded JPEG preview URL (browsers
  // can't render TIFF in <img>), which we use instead of the raw blob.
  const handleImageUpload = useCallback(async (file: File, externalPreviewUrl?: string) => {
    setError('')
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return externalPreviewUrl ?? URL.createObjectURL(file)
    })
    setPendingFile(file)
    setPendingImageRemoval(false)
  }, [])

  // Mark the image for removal (or just discard a not-yet-saved pick). The
  // actual deletion happens on save.
  const handleRemoveImage = useCallback(() => {
    if (pendingFile) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPendingFile(null)
    } else {
      setPendingImageRemoval(true)
    }
  }, [pendingFile])

  // What the form should show: the pending preview, nothing (pending removal),
  // or the saved image.
  const displayImageUrl = pendingFile ? previewUrl : pendingImageRemoval ? null : imageUrl

  // Sound upload (immediate)
  const handleSoundUpload = useCallback(
    async (file: File) => {
      setSoundUploading(true)
      setError('')
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('sound', file)
        const response = await fetch(`/api/artworks/${artworkId}/sound`, {
          method: 'POST',
          body: uploadFormData,
        })
        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to upload sound')
          return
        }
        const data = await response.json()
        setSoundUrl(data.url)
        // Sync with Redux so the 3D scene updates
        dispatch(
          editArtwork({ currentArtworkId: artworkId, property: 'soundUrl', value: data.url }),
        )
      } catch {
        setError('Failed to upload sound')
      } finally {
        setSoundUploading(false)
      }
    },
    [artworkId, dispatch],
  )

  const handleSoundRemove = useCallback(async () => {
    setError('')
    try {
      const response = await fetch(`/api/artworks/${artworkId}/sound`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove sound')
        return
      }
      setSoundUrl(null)
      dispatch(editArtwork({ currentArtworkId: artworkId, property: 'soundUrl', value: undefined }))
    } catch {
      setError('Failed to remove sound')
    }
  }, [artworkId, dispatch])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className={styles.overlay} data-no-deselect="true">
        <div className={styles.modal}>
          <header className={styles.header}>
            <Button
              variant="ghost"
              onClick={handleClose}
              label="CLOSE"
              iconRight={<Icon name="close" size={16} />}
              className={styles.closeButton}
              aria-label="Close"
            />
          </header>
          <div className={styles.content}>Loading...</div>
        </div>
      </div>
    )
  }

  if (error && !artwork) {
    return (
      <div className={styles.overlay} data-no-deselect="true">
        <div className={styles.modal}>
          <header className={styles.header}>
            <Button
              variant="ghost"
              onClick={handleClose}
              label="CLOSE"
              iconRight={<Icon name="close" size={16} />}
              className={styles.closeButton}
              aria-label="Close"
            />
          </header>
          <div className={styles.content}>
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} data-no-deselect="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <Button
            variant="ghost"
            onClick={handleClose}
            label="CLOSE"
            iconRight={<Icon name="close" size={16} />}
            className={styles.closeButton}
            aria-label="Close"
          />
        </header>
        <div className={styles.content}>
          <ArtworkEditForm
            formData={formData}
            imageUrl={displayImageUrl}
            imageDpi={imageDpi}
            originalWidth={originalInfo.width}
            originalHeight={originalInfo.height}
            originalImageUrl={originalInfo.originalImageUrl}
            originalFormat={originalInfo.format}
            originalSizeBytes={originalInfo.sizeBytes}
            soundUrl={soundUrl}
            uploading={soundUploading}
            loadingText="Uploading sound..."
            saving={saving}
            error={error}
            onFormChange={handleChange}
            onPrintOptionsChange={handlePrintOptionsChange}
            onPrintRecommendationsChange={handlePrintRecommendationsChange}
            onImageUpload={handleImageUpload}
            onImageRemove={handleRemoveImage}
            onSoundUpload={handleSoundUpload}
            onSoundRemove={handleSoundRemove}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        </div>
      </div>
    </div>
  )
}
