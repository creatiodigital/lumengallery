'use client'

import React, { useState } from 'react'

import { useArtists } from '@/hooks/useArtists'
import { useUpdateArtist } from '@/hooks/useUpdateArtist'

export const DashboardAdmin = () => {
  const { artists, loading, error } = useArtists()
  const { updateArtist, statusById } = useUpdateArtist()
  const [editingArtists, setEditingArtists] = useState({}) // key = artist.id

  console.log('artists', artists)

  const handleChange = (id, field, value) => {
    setEditingArtists((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const handleSave = async (id) => {
    const updates = editingArtists[id]
    if (!updates) return

    await updateArtist({ id, ...updates })
  }

  const getFieldValue = (artist, field) => {
    return editingArtists[artist.id]?.[field] ?? artist[field] ?? ''
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>All Artists</h1>
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
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
          {artists.map((artist) => (
            <tr key={artist.id}>
              <td>{artist.id}</td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(artist, 'name')}
                  onChange={(e) => handleChange(artist.id, 'name', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(artist, 'lastName')}
                  onChange={(e) => handleChange(artist.id, 'lastName', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(artist, 'handler')}
                  onChange={(e) => handleChange(artist.id, 'handler', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(artist, 'biography')}
                  onChange={(e) => handleChange(artist.id, 'biography', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="email"
                  value={getFieldValue(artist, 'email')}
                  onChange={(e) => handleChange(artist.id, 'email', e.target.value)}
                />
              </td>
              <td>
                <button onClick={() => handleSave(artist.id)}>
                  {statusById[artist.id] === 'saving'
                    ? 'Saving...'
                    : statusById[artist.id] === 'saved'
                      ? 'Saved ✓'
                      : 'Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
