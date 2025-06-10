'use client'

import { useState } from 'react'

export function useUpdateArtist() {
  const [statusById, setStatusById] = useState({})

  const updateArtist = async ({ id, name, lastName, biography, userType, handler, email }) => {
    setStatusById((prev) => ({ ...prev, [id]: 'saving' }))

    try {
      const res = await fetch(`/api/artists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lastName, biography, userType, handler, email }),
      })

      if (!res.ok) throw new Error('Failed to update artist')

      setStatusById((prev) => ({ ...prev, [id]: 'saved' }))
      return true
    } catch (error) {
      console.error('[useUpdateArtist] error:', error)
      setStatusById((prev) => ({ ...prev, [id]: 'error' }))
      return false
    }
  }

  return { updateArtist, statusById }
}
