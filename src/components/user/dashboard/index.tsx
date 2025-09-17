'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { EditView } from '@/components/editview'
import { Button } from '@/components/ui/Button'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { Modal } from '@/components/ui/Modal'
import { selectExhibitions } from '@/redux/selectors/userSelectors'
import { selectSpace } from '@/redux/slices/dashboardSlice'
import {
  useGetExhibitionsByUserQuery,
  useCreateExhibitionMutation,
  useDeleteExhibitionMutation,
} from '@/redux/slices/exhibitionApi'
import { useGetUserQuery } from '@/redux/slices/userApi'
import { addExhibition, hydrateExhibitions, removeExhibition } from '@/redux/slices/userSlice'
import type { RootState, AppDispatch } from '@/redux/store'
import type { TOption } from '@/types/artwork'
import type { TSpaceOption } from '@/types/dashboard'
import type { TExhibition } from '@/types/exhibition'

import { spaceOptions } from './constants'
import styles from './Dashboard.module.scss'

export const Dashboard = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()

  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const exhibitions = useSelector(selectExhibitions)
  const [deleteExhibition] = useDeleteExhibitionMutation()

  const [isModalShown, setIsModalShown] = useState(false)

  const hardcodedId = '915a1541-f132-4fd1-a714-e34527485054'

  const { data: userData } = useGetUserQuery(hardcodedId)
  const { data: exhibitionsData } = useGetExhibitionsByUserQuery(hardcodedId)

  const [createExhibition, { isLoading: creating, error }] = useCreateExhibitionMutation()

  useEffect(() => {
    if (exhibitionsData) {
      dispatch(hydrateExhibitions(exhibitionsData))
    }
  }, [exhibitionsData, dispatch])

  const handleSelectSpace = useCallback(
    (option: TOption<string>) => {
      dispatch(selectSpace(option.value as unknown as TSpaceOption))
    },
    [dispatch],
  )

  const handleNewExhibition = useCallback(() => {
    setIsModalShown(true)
  }, [])

  const handleCreateExhibition = useCallback(
    async (mainTitle: string, visibility: string) => {
      try {
        const newEx = await createExhibition({
          mainTitle,
          visibility,
          userId: userData?.id ?? '',
          userHandler: userData?.handler ?? '',
          spaceId: 'modern',
        }).unwrap()
        dispatch(addExhibition(newEx))
        setIsModalShown(false)
      } catch (err) {
        console.error('Failed to create exhibition', err)
      }
    },
    [createExhibition, dispatch, userData?.id, userData?.handler],
  )

  const handleDeleteExhibition = useCallback(
    async (id: string) => {
      try {
        await deleteExhibition(id).unwrap()
        dispatch(removeExhibition(id))
      } catch (err) {
        console.error('Failed to delete exhibition', err)
      }
    },
    [deleteExhibition, dispatch],
  )

  return (
    <div className={styles.dashboard}>
      {!isEditMode && (
        <div className={styles.main}>
          <div className={styles.header}>
            <h3>Hello {userData?.name ?? ''}</h3>
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
                        onClick={() =>
                          router.push(`/${userData?.handler}/exhibition/${ex.url}/edit`)
                        }
                      />
                      <Button
                        variant="small"
                        label="Delete"
                        onClick={() => handleDeleteExhibition(ex.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {isModalShown && (
            <Modal onClose={() => setIsModalShown(false)}>
              <ExhibitionModal
                creating={creating}
                onClose={() => setIsModalShown(false)}
                onCreate={handleCreateExhibition}
                selectedSpace={selectedSpace}
                handleSelectSpace={handleSelectSpace}
                spaceOptions={spaceOptions}
              />
            </Modal>
          )}

          {error && <p className={styles.error}>⚠️ {JSON.stringify(error)}</p>}
        </div>
      )}
      {isEditMode && <EditView />}
    </div>
  )
}
