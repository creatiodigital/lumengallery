import { useDispatch } from 'react-redux'

import { editArtisticImage } from '@/redux/slices/artworksSlice'
import { setArtworkUploadedTrue } from '@/redux/slices/wizardSlice'

export const useFileUpload = (currentArtworkId) => {
  const dispatch = useDispatch()

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file && currentArtworkId) {
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

  return { handleFileChange, triggerFileUpload }
}
