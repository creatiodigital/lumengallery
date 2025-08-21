'use client'

import { useEffect, useState } from 'react'

import type { Artist } from '@/types/artist'

export function useArtists() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchArtists() {
      try {
        const res = await fetch('/api/artists', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch artists')
        const data: Artist[] = await res.json()
        setArtists(data)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Unknown error')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchArtists()
  }, [])

  return { artists, loading, error }
}
