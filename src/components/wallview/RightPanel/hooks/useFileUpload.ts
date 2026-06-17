import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { useDispatch } from 'react-redux'

import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { editArtisticImage } from '@/redux/slices/artworkSlice'
import { setArtworkUploadedTrue } from '@/redux/slices/wizardSlice'

export const useFileUpload = (currentArtworkId: string) => {
  const dispatch = useDispatch()
  const [uploadError, setUploadError] = useState<string | null>(null)

  const clearUploadError = () => setUploadError(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    // Client-side size validation
    if (file && file.size > MAX_UPLOAD_SIZE) {
      setUploadError(`File too large. Maximum size is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB.`)
      event.target.value = '' // Reset input
      return
    }

    if (file && currentArtworkId) {
      setUploadError(null)
      const imageUrl = URL.createObjectURL(file)
      dispatch(editArtisticImage({ currentArtworkId, property: 'imageUrl', value: imageUrl }))
    }
  }

  const triggerFileUpload = () => {
    const fileInput = document.getElementById('file-upload')
    if (fileInput) {
      setTimeout(() => fileInput.click(), 0)
    } else {
      console.error('File input not found')
    }

    dispatch(setArtworkUploadedTrue())
  }

  return { handleFileChange, triggerFileUpload, uploadError, clearUploadError }
}
