'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { EditView } from '@/components/editview'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { fetchArtist } from '@/lib/features/artistSlice'
import { showEditMode, selectSpace } from '@/lib/features/dashboardSlice'
import { addExhibition, fetchExhibitionsByArtist } from '@/lib/features/artistSlice'
import { useCreateExhibition } from '@/hooks/useCreateExhibition'

import { spaceOptions } from './constants'
import styles from './Dashboard.module.scss'

export const Dashboard = () => {
  const dispatch = useDispatch()
  const isEditMode = useSelector((state) => state.dashboard.isEditMode)
  const selectedSpace = useSelector((state) => state.dashboard.selectedSpace)
  const { name, id, handler } = useSelector((state) => state.artist)
  const [isModalShown, setIsModalShown] = useState(false)
  const [mainTitle, setMainTitle] = useState('')
  const [visibility, setVisibility] = useState('private')
  const { createExhibition, loading, error } = useCreateExhibition()
  const exhibitions = useSelector((state) =>
    state.artist.allExhibitionIds.map((id) => state.artist.exhibitionsById[id]),
  )

  useEffect(() => {
    const hardcodedId = '915a1541-f132-4fd1-a714-e34527485054'

    // First fetch the artist
    dispatch(fetchArtist(hardcodedId)).then((action) => {
      // Once loaded, fetch their exhibitions using the ID
      const artistId = action.payload.id
      dispatch(fetchExhibitionsByArtist(artistId))
    })
  }, [dispatch])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  const handleSelectSpace = (space) => {
    dispatch(selectSpace(space))
  }

  const handleNewExhibition = () => {
    setIsModalShown(true)
  }

  const handleCreateExhibition = async () => {
    const exhibition = await createExhibition({
      mainTitle,
      visibility: 'public',
      userId: id,
      userHandler: handler,
      spaceId: 'modern',
    })

    if (exhibition) {
      setIsModalShown(false)
      dispatch(addExhibition(exhibition))
    }
  }

  return (
    <div className={styles.dashboard}>
      {!isEditMode && (
        <div className={styles.main}>
          <div className={styles.header}>
            <h3>Hello {`${name}`}</h3>
          </div>
          <div className={styles.exhibitions}>
            <Button type="small" label="New exhibition" onClick={handleNewExhibition} />
            <div className={styles.list}>
              <h3 className={styles.subtitle}>My exhibitions</h3>
              {exhibitions.length === 0 ? (
                <p>You don't have any exhibitions yet.</p>
              ) : (
                <ul className={styles.exhibitionList}>
                  {exhibitions.map((ex) => (
                    <li key={ex.id} className={styles.exhibitionItem}>
                      {ex.mainTitle}{' '}
                      <Button type="small" label="Edit" onClick={() => console.log('Edit', ex)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div>
            <Button type="small" onClick={handleEditGallery} label="Create Exhibition" />
          </div>
          {isModalShown && (
            <Modal>
              <div className={styles.wrapper}>
                <div className={styles.content}>
                  <h3>Exhibition Title</h3>
                  <input
                    type="text"
                    value={mainTitle}
                    onChange={(e) => setMainTitle(e.target.value)}
                    placeholder="e.g. My New Exhibition"
                    className={styles.input}
                  />
                  <h3>Visibility</h3>
                  <Select
                    options={[
                      { value: 'public', label: 'Public' },
                      { value: 'private', label: 'Private' },
                    ]}
                    onSelect={(value) => setVisibility(value)}
                    selectedLabel={visibility}
                    size="medium"
                  />
                  <h3>Choose a Space</h3>
                  <Select
                    options={spaceOptions}
                    onSelect={handleSelectSpace}
                    selectedLabel={selectedSpace}
                    size="medium"
                  />
                </div>
                <div className={styles.ctas}>
                  <Button type="small" label="Cancel" onClick={() => setIsModalShown(false)} />
                  <Button
                    type="small"
                    label={loading ? 'Creating...' : 'Create'}
                    onClick={handleCreateExhibition}
                  />
                </div>
              </div>
            </Modal>
          )}
          {error && <p className={styles.error}>⚠️ {error}</p>}
        </div>
      )}
      {isEditMode && <EditView />}
    </div>
  )
}
