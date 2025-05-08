'use client'

import { useEffect, useState } from 'react'

export function useArtists() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchArtists() {
      try {
        const res = await fetch('/api/artists', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch artists')
        const data = await res.json()
        setArtists(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchArtists()
  }, [])

  return { artists, loading, error }
}
