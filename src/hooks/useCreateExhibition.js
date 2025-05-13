'use client'

import { useState } from 'react'

export function useCreateExhibition() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createdExhibition, setCreatedExhibition] = useState(null)

  const slugify = (str) =>
    str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim()

  const createExhibition = async ({ mainTitle, visibility, userId, userHandler, spaceId = '' }) => {
    setLoading(true)
    setError(null)

    const handler = slugify(mainTitle)
    const url = `${userHandler}/${handler}`

    console.log('xxx', mainTitle, visibility, userId, handler, url, spaceId)

    try {
      const res = await fetch('/api/exhibitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainTitle,
          visibility,
          userId,
          handler,
          url,
          spaceId,
        }),
      })

      if (!res.ok) throw new Error('Failed to create exhibition')

      const data = await res.json()
      setCreatedExhibition(data)
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    createExhibition,
    createdExhibition,
    loading,
    error,
  }
}
