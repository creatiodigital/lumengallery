import { useDispatch, useSelector } from 'react-redux'

import { chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'
import { hideWizard } from '@/redux/slices/wizardSlice'

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
