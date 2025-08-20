import { createSlice } from '@reduxjs/toolkit'

import { wizardFactory } from '@/factories/wizardFactory'
import type { Wizard } from '@/types/wizard'

const wizardSlice = createSlice({
  name: 'wizard',
  initialState: wizardFactory(),
  reducers: {
    showWizard: (state: Wizard) => {
      state.isWizardOpen = true
    },
    hideWizard: (state: Wizard) => {
      state.isWizardOpen = false
    },
    setArtworkUploadedTrue: (state: Wizard) => {
      state.isArtworkUploaded = true
    },
    setArtworkUploadedFalse: (state: Wizard) => {
      state.isArtworkUploaded = false
    },
  },
})

export const { showWizard, hideWizard, setArtworkUploadedTrue, setArtworkUploadedFalse } =
  wizardSlice.actions

export default wizardSlice.reducer
