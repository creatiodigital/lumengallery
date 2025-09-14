import { createSlice } from '@reduxjs/toolkit'

import { wizardFactory } from '@/factories/wizardFactory'
import type { TWizard } from '@/types/wizard'

const wizardSlice = createSlice({
  name: 'wizard',
  initialState: wizardFactory(),
  reducers: {
    showWizard: (state: TWizard) => {
      state.isWizardOpen = true
    },
    hideWizard: (state: TWizard) => {
      state.isWizardOpen = false
    },
    setArtworkUploadedTrue: (state: TWizard) => {
      state.isArtworkUploaded = true
    },
    setArtworkUploadedFalse: (state: TWizard) => {
      state.isArtworkUploaded = false
    },
  },
})

export const { showWizard, hideWizard, setArtworkUploadedTrue, setArtworkUploadedFalse } =
  wizardSlice.actions

export default wizardSlice.reducer
