import { createSlice } from '@reduxjs/toolkit'

const wizardSlice = createSlice({
  name: 'wizard',
  initialState: {
    isWizardOpen: false,
    isArtworkUploaded: false,
  },
  reducers: {
    showWizard: (state) => {
      state.isWizardOpen = true
    },
    hideWizard: (state) => {
      state.isWizardOpen = false
    },
    setArtworkUploadedTrue: (state) => {
      state.isArtworkUploaded = true
    },
    setArtworkUploadedFalse: (state) => {
      state.isArtworkUploaded = false
    },
  },
})

export const {
  showWizard,
  hideWizard,
  setArtworkUploadedTrue,
  setArtworkUploadedFalse,
} = wizardSlice.actions
export default wizardSlice.reducer
