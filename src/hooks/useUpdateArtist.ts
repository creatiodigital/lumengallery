'use client'

import { useState } from 'react'

import type { RequestStatus } from '@/types/api'
import type { ArtistType } from '@/types/artist'

export function useUpdateArtist() {
  const [statusById, setStatusById] = useState<Record<string, RequestStatus>>({})

  const updateArtist = async (artist: ArtistType): Promise<boolean> => {
    const { id, ...rest } = artist

    setStatusById((prev) => ({ ...prev, [id]: 'pending' }))

    try {
      const res = await fetch(`/api/artists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })

      if (!res.ok) throw new Error('Failed to update artist')

      setStatusById((prev) => ({ ...prev, [id]: 'fulfilled' }))
      return true
    } catch (error) {
      console.error('[useUpdateArtist] error:', error)
      setStatusById((prev) => ({ ...prev, [id]: 'rejected' }))
      return false
    }
  }

  return { updateArtist, statusById }
}
