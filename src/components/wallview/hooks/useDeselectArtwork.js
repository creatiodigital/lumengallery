import { useDispatch, useSelector } from 'react-redux'

import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { hideWizard } from '@/lib/features/wizardSlice'

export const useDeselectArtwork = () => {
  const dispatch = useDispatch()
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)

  const handleDeselect = () => {
    dispatch(chooseCurrentArtworkId(null))
    if (isWizardOpen) {
      dispatch(hideWizard())
    }
  }

  return { handleDeselect }
}
