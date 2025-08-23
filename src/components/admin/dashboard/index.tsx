'use client'

import React, { useState } from 'react'

import { useArtists } from '@/hooks/useArtists'
// import { useUpdateArtist } from '@/hooks/useUpdateArtist'
import type { ArtistType } from '@/types/artist'

export const DashboardAdmin = () => {
  const { artists, loading, error } = useArtists()
  // const { updateArtist, statusById} = useUpdateArtist()

  // store a full Artist for each editing entry
  const [editingArtists, setEditingArtists] = useState<Record<string, ArtistType>>({})

  const handleChange = (id: string, field: keyof ArtistType, value: string) => {
    setEditingArtists((prev) => {
      const current = prev[id] ?? artists.find((a) => a.id === id)
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
  //   const artist = editingArtists[id]
  //   if (!artist) return

  //   await updateArtist(artist)
  // }

  const getFieldValue = (artist: ArtistType, field: keyof ArtistType): string => {
    return (editingArtists[artist.id]?.[field] as string) ?? (artist[field] as string) ?? ''
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>All Artists</h1>
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
              {/* <td>
                {(() => {
                  const requestStatus = statusById[artist.id] ?? 'idle'

                  return (
                    <Button
                      variant="small"
                      label={
                        requestStatus === 'loading'
                          ? 'Saving...'
                          : requestStatus === 'success'
                            ? 'Saved ✓'
                            : 'Save'
                      }
                      onClick={() => handleSave(artist.id)}
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
