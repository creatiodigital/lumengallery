import { createSlice } from '@reduxjs/toolkit'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    isEditMode: false,
  },
  reducers: {
    showEditMode: (state) => {
      state.isEditMode = true
    },
    hideEditMode: (state) => {
      state.isEditMode = false
    },
  },
})

export const { showEditMode, hideEditMode } = dashboardSlice.actions
export default dashboardSlice.reducer
