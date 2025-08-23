import { createSlice } from '@reduxjs/toolkit'

import { wizardFactory } from '@/factories/wizardFactory'
import type { WizardType } from '@/types/wizard'

const wizardSlice = createSlice({
  name: 'wizard',
  initialState: wizardFactory(),
  reducers: {
    showWizard: (state: WizardType) => {
      state.isWizardOpen = true
    },
    hideWizard: (state: WizardType) => {
      state.isWizardOpen = false
    },
    setArtworkUploadedTrue: (state: WizardType) => {
      state.isArtworkUploaded = true
    },
    setArtworkUploadedFalse: (state: WizardType) => {
      state.isArtworkUploaded = false
    },
  },
})

export const { showWizard, hideWizard, setArtworkUploadedTrue, setArtworkUploadedFalse } =
  wizardSlice.actions

export default wizardSlice.reducer
