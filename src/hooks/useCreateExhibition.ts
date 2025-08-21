'use client'

import { useState } from 'react'

import type { Exhibition } from '@/types/exhibition'

type CreateExhibitionType = {
  mainTitle: string
  visibility: string
  userId: string
  userHandler: string
  spaceId?: string
}

export function useCreateExhibition() {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [createdExhibition, setCreatedExhibition] = useState<Exhibition | null>(null)

  const slugify = (str: string): string =>
    str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim()

  const createExhibition = async ({
    mainTitle,
    visibility,
    userId,
    userHandler,
    spaceId = '',
  }: CreateExhibitionType): Promise<Exhibition | null> => {
    setLoading(true)
    setError(null)

    const handler = slugify(mainTitle)
    const url = `${userHandler}/${handler}`

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

      const data: Exhibition = await res.json()
      setCreatedExhibition(data)
      return data
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Unknown error')
      }
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
