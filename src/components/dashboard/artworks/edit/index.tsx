'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '../../DashboardLayout'
import { ErrorText } from '@/components/ui/ErrorText'
import {
  ArtworkEditForm,
  getInitialFormData,
  populateFormData,
} from '@/components/shared/ArtworkEditForm'
import type { Artwork, ArtworkFormData } from '@/components/shared/ArtworkEditForm'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'

type ArtworkEditPageProps = {
  artworkId: string
}

export const ArtworkEditPage = ({ artworkId }: ArtworkEditPageProps) => {
  const { data: session } = useSession()
  const router = useRouter()
  const backLink = '/dashboard/artworks'

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<ArtworkFormData>(getInitialFormData())

  // Original image URL from server
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  // Pending file to upload (not yet saved)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Local preview URL for pending file
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Track if user wants to remove the original image (only delete on save)
  const [pendingImageRemoval, setPendingImageRemoval] = useState(false)

  // Original image info from server
  const [imageDpi, setImageDpi] = useState<number | null>(null)
  const [originalInfo, setOriginalInfo] = useState<{
    width: number | null
    height: number | null
    originalImageUrl: string | null
    format: string | null
    sizeBytes: number | null
  }>({ width: null, height: null, originalImageUrl: null, format: null, sizeBytes: null })

  // Sound state (sound uploads are immediate, not deferred)
  const [soundUrl, setSoundUrl] = useState<string | null>(null)
  const [soundUploading, setSoundUploading] = useState(false)

  // Video state (video uploads are immediate, not deferred)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoUploading, setVideoUploading] = useState(false)

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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
          router.push(backLink)
          return
        }

        setArtwork(data)
        setOriginalImageUrl(data.imageUrl)
        setImageDpi(data.originalDpi ?? null)
        setOriginalInfo({
          width: data.originalWidth ?? null,
          height: data.originalHeight ?? null,
          originalImageUrl: data.originalImageUrl ?? null,
          format: data.originalFormat ?? null,
          sizeBytes: data.originalSizeBytes ?? null,
        })
        setSoundUrl(data.soundUrl || null)
        setVideoUrl(data.videoUrl || null)
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
  }, [artworkId, session?.user?.id, session?.user?.userType, router, backLink])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrintOptionsChange = (next: PrintRestrictions | null) => {
    setFormData((prev) => {
      // If a paper just got vetoed, drop it from the recommendations
      // so the two stay consistent (the wizard ignores recommendations
      // outside the allowed set anyway, but better to fix at the source).
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Step 1: If there's a pending file, upload via presigned URL
      if (pendingFile) {
        // 1a. Get presigned URL for the original
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

        // 1b. Upload original directly to R2
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

        // 1c. Finalize — server rebuilds the public URL from the key it
        // already issued in step 1a, then generates the web-optimized
        // version. We deliberately send the opaque key (not a URL) so
        // the complete step can never be pointed at an external host.
        const completeRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'complete',
            artworkId,
            originalKey,
          }),
        })

        const result = await completeRes.json()
        if (!completeRes.ok) {
          setError(result.error || 'Failed to process image')
          setSaving(false)
          return
        }

        // Update local state with server-processed original metadata
        setOriginalImageUrl(result.imageUrl)
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
      // Step 2: If image was marked for removal (and no new file), delete it
      else if (pendingImageRemoval && originalImageUrl) {
        const deleteResponse = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'DELETE',
        })
        if (!deleteResponse.ok) {
          const data = await deleteResponse.json()
          setError(data.error || 'Failed to remove image')
          setSaving(false)
          return
        }
      }

      // Step 3: Update artwork metadata. Transform the euros-string the UI
      // tracks back into the cents-integer the DB uses.
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

      router.push(backLink)
    } catch {
      setError('Something went wrong')
      setSaving(false)
    }
  }

  // Store file locally and create preview (actual upload happens on save).
  // For TIFFs the uploader supplies a pre-decoded JPEG preview URL since
  // the browser can't render TIFF in <img>; we use that instead of the
  // raw blob URL so the user actually sees the artwork before saving.
  const handleImageUpload = useCallback(
    async (file: File, externalPreviewUrl?: string) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const newPreviewUrl = externalPreviewUrl ?? URL.createObjectURL(file)
      setPreviewUrl(newPreviewUrl)
      setPendingFile(file)
      setPendingImageRemoval(false)
    },
    [previewUrl],
  )

  // Mark image for removal (actual deletion happens on save)
  const handleRemoveImage = useCallback(() => {
    // If there's a pending file, just clear it
    if (pendingFile) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPendingFile(null)
      setPreviewUrl(null)
    } else {
      // Mark original image for removal
      setPendingImageRemoval(true)
    }
  }, [pendingFile, previewUrl])

  // Determine what image URL to display
  const displayImageUrl = pendingFile ? previewUrl : pendingImageRemoval ? null : originalImageUrl

  // Sound upload (immediate - no deferred save needed)
  const handleSoundUpload = useCallback(
    async (file: File) => {
      setSoundUploading(true)
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
      } catch {
        setError('Failed to upload sound')
      } finally {
        setSoundUploading(false)
      }
    },
    [artworkId],
  )

  const handleSoundRemove = useCallback(async () => {
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
    } catch {
      setError('Failed to remove sound')
    }
  }, [artworkId])

  // Video upload (client-side direct upload to R2 via presigned URL)
  const handleVideoUpload = useCallback(
    async (file: File) => {
      setVideoUploading(true)
      try {
        // Step 1: Get presigned upload URL from the server
        const response = await fetch('/api/upload/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'request-upload',
            artworkId,
            contentType: file.type,
            fileSize: file.size,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to get upload URL')
        }

        const { presignedUrl, publicUrl } = await response.json()

        // Step 2: Upload file directly to R2
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload video to storage')
        }

        // Step 3: Finalize — update artwork record with the new URL
        const finalizeResponse = await fetch('/api/upload/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'complete',
            artworkId,
            url: publicUrl,
          }),
        })

        if (!finalizeResponse.ok) {
          const data = await finalizeResponse.json()
          throw new Error(data.error || 'Failed to finalize upload')
        }

        setVideoUrl(publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload video')
      } finally {
        setVideoUploading(false)
      }
    },
    [artworkId],
  )

  const handleVideoRemove = useCallback(async () => {
    try {
      const response = await fetch(`/api/artworks/${artworkId}/video`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove video')
        return
      }

      setVideoUrl(null)
    } catch {
      setError('Failed to remove video')
    }
  }, [artworkId])

  if (loading) {
    return (
      <DashboardLayout backLink={backLink} backLabel="← Back to Library">
        Loading...
      </DashboardLayout>
    )
  }

  if (error && !artwork) {
    return (
      <DashboardLayout backLink={backLink} backLabel="← Back to Library">
        <ErrorText>{error}</ErrorText>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout backLink={backLink} backLabel="← Back to Library">
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
        videoUrl={videoUrl}
        uploading={soundUploading || videoUploading}
        loadingText={videoUploading ? 'Uploading video...' : 'Uploading sound...'}
        saving={saving}
        error={error}
        onFormChange={handleChange}
        onPrintOptionsChange={handlePrintOptionsChange}
        onPrintRecommendationsChange={handlePrintRecommendationsChange}
        onImageUpload={handleImageUpload}
        onImageRemove={handleRemoveImage}
        onSoundUpload={handleSoundUpload}
        onSoundRemove={handleSoundRemove}
        onVideoUpload={handleVideoUpload}
        onVideoRemove={handleVideoRemove}
        onSubmit={handleSubmit}
        onCancel={() => router.push(backLink)}
      />
    </DashboardLayout>
  )
}
