'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '../../DashboardLayout'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ErrorText } from '@/components/ui/ErrorText'
import {
  ArtworkEditForm,
  getInitialFormData,
  populateFormData,
} from '@/components/shared/ArtworkEditForm'
import type { Artwork, ArtworkFormData } from '@/components/shared/ArtworkEditForm'
import type { LimitedVariantDraft } from '@/lib/editions/types'
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
  // "Ready to Sell" confirmation modal + in-flight publish guard.
  // `showReadyModal` is the artwork-level publish (open editions);
  // `readyVariantIndex` is the per-variant publish (limited editions).
  const [showReadyModal, setShowReadyModal] = useState(false)
  const [readyVariantIndex, setReadyVariantIndex] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
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

  const handleEditionTypeChange = (next: 'open' | 'limited') => {
    setFormData((prev) => ({ ...prev, editionType: next }))
  }

  const handleVariantsChange = (next: LimitedVariantDraft[]) => {
    setFormData((prev) => ({ ...prev, limitedVariants: next }))
  }

  // Inline role check — don't import @/lib/authUtils here; it pulls in the
  // server-only auth + prisma chain and breaks this client component.
  const userType = session?.user?.userType
  const isAdmin = userType === 'admin' || userType === 'superAdmin'
  const isSuperAdmin = userType === 'superAdmin'

  // "Ready to Sell" — artist confirms the artwork is good to sell. Opens a
  // confirm modal; the publish (which locks the edition config and publishes
  // limited variants) only fires once they confirm.
  const handleReadyToSell = useCallback(() => {
    setShowReadyModal(true)
  }, [])

  const confirmReadyToSell = useCallback(async () => {
    setPublishing(true)
    setError('')
    try {
      const res = await fetch(`/api/artworks/${artworkId}/publish-edition`, { method: 'POST' })
      if (res.ok) {
        setFormData((prev) => ({ ...prev, editionLocked: true }))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to mark ready to sell.')
      }
    } catch {
      setError('Failed to mark ready to sell.')
    } finally {
      setPublishing(false)
      setShowReadyModal(false)
    }
  }, [artworkId])

  // Admin-only: unblock a locked artwork so its config is editable again.
  const handleUnblock = useCallback(async () => {
    try {
      const res = await fetch(`/api/artworks/${artworkId}/unblock-edition`, { method: 'POST' })
      if (res.ok) {
        setFormData((prev) => ({ ...prev, editionLocked: false }))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to unblock artwork.')
      }
    } catch {
      setError('Failed to unblock artwork.')
    }
  }, [artworkId])

  // Admin-only: take a live variant off sale (`blocked: false`) so its fields
  // reopen for editing. Resuming sale is the artist's "Ready to Sell" again.
  const handleUnblockVariant = useCallback(
    async (variantId: string) => {
      try {
        const res = await fetch(`/api/artworks/${artworkId}/variants/${variantId}/unblock`, {
          method: 'POST',
        })
        if (res.ok) {
          setFormData((prev) => {
            const limitedVariants = prev.limitedVariants.map((v) =>
              v.id === variantId ? { ...v, blocked: false } : v,
            )
            // Keep editionLocked in sync with the server's recompute: the
            // artwork is locked only while a variant is still live. Without
            // this the stale flag would make a later switch to Open edition
            // look "on sale + locked".
            const stillLive = limitedVariants.some(
              (v) => v.published === true && v.blocked !== false,
            )
            return { ...prev, limitedVariants, editionLocked: stillLive }
          })
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Failed to unblock variant.')
        }
      } catch {
        setError('Failed to unblock variant.')
      }
    },
    [artworkId],
  )

  // Persist the whole form (pending image + metadata + limited variants).
  // Returns true on success. Used by both the Save button and the per-variant
  // "Ready to Sell" flow (which saves before it publishes). Does not navigate
  // or manage the busy spinner — callers own that.
  const saveArtwork = async (): Promise<boolean> => {
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
          return false
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
          return false
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
          return false
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
          return false
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
        return false
      }

      return true
    } catch {
      setError('Something went wrong')
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ok = await saveArtwork()
    if (ok) {
      router.push(backLink)
    } else {
      setSaving(false)
    }
  }

  // Per-variant "Ready to Sell" (limited editions). Opens the confirm modal
  // for the variant at `index`; the publish only fires on confirm.
  const handleReadyToSellVariant = (index: number) => {
    setReadyVariantIndex(index)
  }

  // Save the whole form, then put the target variant on sale. We save first
  // because the variant may be a brand-new unsaved draft (no id yet) and the
  // save also validates every variant — an invalid form blocks the action.
  // A never-published draft is published (materialises its edition); a
  // previously-unblocked published variant is simply resumed (re-blocked).
  const confirmReadyToSellVariant = async () => {
    if (readyVariantIndex === null) return
    const index = readyVariantIndex
    const wasPublished = formData.limitedVariants[index]?.published === true
    setPublishing(true)
    setError('')

    const saved = await saveArtwork()
    if (!saved) {
      setPublishing(false)
      setReadyVariantIndex(null)
      return
    }

    try {
      // Resolve the just-saved variant's id by position: saveLimitedVariants
      // writes `order = array index`, and the GET returns variants ordered by
      // `order`, so index lines up with the editor's row.
      const res = await fetch(`/api/artworks/${artworkId}`)
      const fresh = await res.json()
      const variant = (fresh.limitedVariants ?? [])[index]
      if (!variant?.id) {
        setError('Could not find the saved variant to put on sale.')
        return
      }

      // Draft → publish (materialise edition). Unblocked published → block
      // (resume sale). Both freeze the variant + lock the series type.
      const action = wasPublished ? 'block' : 'publish'
      const put = await fetch(`/api/artworks/${artworkId}/variants/${variant.id}/${action}`, {
        method: 'POST',
      })
      const data = await put.json().catch(() => ({}))
      if (!put.ok) {
        setError(data.error || 'Failed to put variant on sale.')
        return
      }

      // Refresh so the variant shows live + the series type locks. The publish
      // route returns the fresh artwork; the block route doesn't, so refetch.
      const after =
        data.artwork ?? (await fetch(`/api/artworks/${artworkId}`).then((r) => r.json()))
      setArtwork(after)
      setFormData(populateFormData(after))
    } catch {
      setError('Failed to put variant on sale.')
    } finally {
      setPublishing(false)
      setReadyVariantIndex(null)
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

        const { presignedUrl, publicUrl, key } = await response.json()

        // Step 2: Upload file directly to R2
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload video to storage')
        }

        // Step 3: Finalize — send the server-minted key (not a URL); the
        // server validates it and rebuilds the public URL itself.
        const finalizeResponse = await fetch('/api/upload/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'complete',
            artworkId,
            key,
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
        artworkId={artworkId}
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
        onEditionTypeChange={handleEditionTypeChange}
        onVariantsChange={handleVariantsChange}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onReadyToSell={handleReadyToSell}
        onUnblock={handleUnblock}
        onUnblockVariant={handleUnblockVariant}
        onReadyToSellVariant={handleReadyToSellVariant}
        onImageUpload={handleImageUpload}
        onImageRemove={handleRemoveImage}
        onSoundUpload={handleSoundUpload}
        onSoundRemove={handleSoundRemove}
        onVideoUpload={handleVideoUpload}
        onVideoRemove={handleVideoRemove}
        onSubmit={handleSubmit}
        onCancel={() => router.push(backLink)}
      />
      {showReadyModal && (
        <ConfirmModal
          title="Mark this artwork as ready to sell?"
          message="Once confirmed, the edition type and variants are locked and the artwork goes on sale. You can’t change the edition type unless an admin unblocks it. Save any pending changes first."
          confirmLabel="Yes, start selling"
          busy={publishing}
          onConfirm={confirmReadyToSell}
          onCancel={() => setShowReadyModal(false)}
        />
      )}
      {readyVariantIndex !== null && (
        <ConfirmModal
          title="Put this variant on sale?"
          message={`This saves your changes and puts ${
            formData.limitedVariants[readyVariantIndex]?.name?.trim() || 'this variant'
          } on sale as a numbered edition. Its size and edition count are then frozen — only an admin can take it off sale to edit it again.`}
          confirmLabel="Yes, put on sale"
          busy={publishing}
          onConfirm={confirmReadyToSellVariant}
          onCancel={() => setReadyVariantIndex(null)}
        />
      )}
    </DashboardLayout>
  )
}
