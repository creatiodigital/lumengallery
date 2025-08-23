'use client'

import React, { useState } from 'react'

import { useUsers } from '@/hooks/useUsers'
// import { useUpdateUser } from '@/hooks/useUpdateUser'
import type { TUser } from '@/types/user'

export const DashboardAdmin = () => {
  const { users, loading, error } = useUsers()
  // const { updateUser, statusById} = useUpdateUser()

  // store a full User for each editing entry
  const [editingUsers, setEditingUsers] = useState<Record<string, TUser>>({})

  const handleChange = (id: string, field: keyof TUser, value: string) => {
    setEditingUsers((prev) => {
      const current = prev[id] ?? users.find((a) => a.id === id)
      if (!current) return prev

      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  // const handleSave = async (id: string) => {
  //   const user = editingUsers[id]
  //   if (!user) return

  //   await updateUser(user)
  // }

  const getFieldValue = (user: TUser, field: keyof TUser): string => {
    return (editingUsers[user.id]?.[field] as string) ?? (user[field] as string) ?? ''
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>All Users</h1>
      <table border={1} cellPadding="8" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Last Name</th>
            <th>Handler</th>
            <th>Biography</th>
            <th>Email</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'name')}
                  onChange={(e) => handleChange(user.id, 'name', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'lastName')}
                  onChange={(e) => handleChange(user.id, 'lastName', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'handler')}
                  onChange={(e) => handleChange(user.id, 'handler', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'biography')}
                  onChange={(e) => handleChange(user.id, 'biography', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="email"
                  value={getFieldValue(user, 'email')}
                  onChange={(e) => handleChange(user.id, 'email', e.target.value)}
                />
              </td>
              {/* <td>
                {(() => {
                  const TRequestStatusType = statusById[user.id] ?? 'idle'

                  return (
                    <Button
                      variant="small"
                      label={
                        TRequestStatusType === 'loading'
                          ? 'Saving...'
                          : TRequestStatusType === 'success'
                            ? 'Saved ✓'
                            : 'Save'
                      }
                      onClick={() => handleSave(user.id)}
                    />
                  )
                })()}
              </td> */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
