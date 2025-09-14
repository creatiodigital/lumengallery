'use client'

import { useEffect, useState } from 'react'

import type { TUser } from '@/types/user'

export function useUsers() {
  const [users, setUsers] = useState<TUser[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/users', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch users')
        const data: TUser[] = await res.json()
        setUsers(data)
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

    fetchUsers()
  }, [])

  return { users, loading, error }
}
