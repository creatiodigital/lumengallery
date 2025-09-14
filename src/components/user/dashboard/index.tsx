'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { EditView } from '@/components/editview'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useCreateExhibition } from '@/hooks/useCreateExhibition'
import { selectExhibitions } from '@/redux/selectors/artistSelectors'
import { showEditMode, selectSpace } from '@/redux/slices/dashboardSlice'
import { fetchUser, addExhibition, fetchExhibitionsByUser } from '@/redux/slices/userSlice'
import type { RootState, AppDispatch } from '@/redux/store'
import type { TOption } from '@/types/artwork'
import type { TSpaceOption } from '@/types/dashboard'
import type { TExhibition } from '@/types/exhibition'

import { spaceOptions } from './constants'
import styles from './Dashboard.module.scss'

export const Dashboard = () => {
  const dispatch = useDispatch<AppDispatch>()

  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const { name, id, handler } = useSelector((state: RootState) => state.user)
  const exhibitions = useSelector(selectExhibitions)

  const [isModalShown, setIsModalShown] = useState(false)
  const [mainTitle, setMainTitle] = useState('')
  const [visibility, setVisibility] = useState<string>('private')
  const { createExhibition, loading, error } = useCreateExhibition()

  useEffect(() => {
    const hardcodedId = '915a1541-f132-4fd1-a714-e34527485054'

    dispatch(fetchUser(hardcodedId)).then((action) => {
      if (fetchUser.fulfilled.match(action)) {
        const artistId = action.payload.id
        dispatch(fetchExhibitionsByUser(artistId))
      }
    })
  }, [dispatch])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  const handleSelectSpace = (option: TOption<string>) => {
    dispatch(selectSpace(option.value as unknown as TSpaceOption))
  }

  const handleNewExhibition = () => {
    setIsModalShown(true)
  }

  const handleCreateExhibition = async () => {
    const exhibition = await createExhibition({
      mainTitle,
      visibility,
      userId: id,
      userHandler: handler,
      spaceId: 'modern',
    })

    if (exhibition) {
      setIsModalShown(false)
      dispatch(addExhibition(exhibition as TExhibition))
    }
  }

  return (
    <div className={styles.dashboard}>
      {!isEditMode && (
        <div className={styles.main}>
          <div className={styles.header}>
            <h3>Hello {name}</h3>
          </div>

          <div className={styles.exhibitions}>
            <Button variant="small" label="New exhibition" onClick={handleNewExhibition} />
            <div className={styles.list}>
              <h3 className={styles.subtitle}>My exhibitions</h3>
              {exhibitions.length === 0 ? (
                <p>You do not have any exhibitions yet.</p>
              ) : (
                <ul className={styles.exhibitionList}>
                  {exhibitions.map((ex: TExhibition) => (
                    <li key={ex.id} className={styles.exhibitionItem}>
                      {ex.mainTitle}{' '}
                      <Button
                        variant="small"
                        label="Edit"
                        onClick={() => console.log('Edit', ex)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <Button variant="small" onClick={handleEditGallery} label="Create Exhibition" />
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
                  <Select<string>
                    options={[
                      { value: 'public', label: 'Public' },
                      { value: 'private', label: 'Private' },
                    ]}
                    value={visibility}
                    onChange={(val) => setVisibility(val)}
                  />

                  <h3>Choose a Space</h3>
                  <Select<string>
                    options={spaceOptions}
                    value={selectedSpace?.value}
                    onChange={(val) => {
                      const opt = spaceOptions.find((opt) => opt.value === val)
                      if (opt) {
                        handleSelectSpace(opt)
                      }
                    }}
                    size="medium"
                  />
                </div>

                <div className={styles.ctas}>
                  <Button variant="small" label="Cancel" onClick={() => setIsModalShown(false)} />
                  <Button
                    variant="small"
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
