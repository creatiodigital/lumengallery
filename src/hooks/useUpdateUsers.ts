'use client'

import { useState } from 'react'

import type { TRequestStatus } from '@/types/api'
import type { TUser } from '@/types/user'

export function useUpdateUser() {
  const [statusById, setStatusById] = useState<Record<string, TRequestStatus>>({})

  const updateUser = async (user: TUser): Promise<boolean> => {
    const { id, ...rest } = user

    setStatusById((prev) => ({ ...prev, [id]: 'pending' }))

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })

      if (!res.ok) throw new Error('Failed to update user')

      setStatusById((prev) => ({ ...prev, [id]: 'fulfilled' }))
      return true
    } catch (error) {
      console.error('[useUpdateUser] error:', error)
      setStatusById((prev) => ({ ...prev, [id]: 'rejected' }))
      return false
    }
  }

  return { updateUser, statusById }
}
