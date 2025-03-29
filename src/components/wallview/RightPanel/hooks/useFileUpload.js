import { useDispatch } from 'react-redux'

import { editArtworkUrlImage } from '@/lib/features/artworksSlice'
import { setArtworkUploadedTrue } from '@/lib/features/wizardSlice'

export const useFileUpload = (currentArtworkId) => {
  const dispatch = useDispatch()

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file && currentArtworkId) {
      const url = URL.createObjectURL(file)
      dispatch(editArtworkUrlImage({ currentArtworkId, url }))
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

  return { handleFileChange, triggerFileUpload }
}
