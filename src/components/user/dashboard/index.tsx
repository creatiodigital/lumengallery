'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { EditView } from '@/components/editview'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { selectExhibitionsForUser } from '@/redux/selectors/userSelectors'
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

  const hardcodedId = '915a1541-f132-4fd1-a714-e34527485054'

  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const exhibitions = useSelector((state: RootState) =>
    selectExhibitionsForUser(state, hardcodedId),
  )
  const [deleteExhibition] = useDeleteExhibitionMutation()

  const [isModalShown, setIsModalShown] = useState(false)

  const { data: userData } = useGetUserQuery(hardcodedId)
  const { data: exhibitionsData, refetch: refetchExhibitions } =
    useGetExhibitionsByUserQuery(hardcodedId)

  const [createExhibition, { isLoading: creating, error }] = useCreateExhibitionMutation()

  useEffect(() => {
    if (exhibitionsData) {
      dispatch(hydrateExhibitions({ ownerId: hardcodedId, exhibitions: exhibitionsData }))
    }
  }, [exhibitionsData, dispatch])

  const handleSelectSpace = useCallback(
    (option: TOption<string>) => {
      dispatch(selectSpace(option as TSpaceOption))
    },
    [dispatch],
  )

  const handleNewExhibition = useCallback(() => {
    setIsModalShown(true)
  }, [])

  const handleCreateExhibition = useCallback(
    async (mainTitle: string, customUrl: string) => {
      try {
        const newEx = await createExhibition({
          mainTitle,
          userId: userData?.id ?? '',
          userHandler: userData?.handler ?? '',
          spaceId: selectedSpace.value,
          customUrl,
        }).unwrap()
        dispatch(addExhibition(newEx))
        refetchExhibitions()
        setIsModalShown(false)
      } catch (err) {
        console.error('Failed to create exhibition', err)
      }
    },
    [
      createExhibition,
      dispatch,
      userData?.id,
      userData?.handler,
      selectedSpace,
      refetchExhibitions,
    ],
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
            <Text font="dashboard" as="h1">
              Hello {userData?.name ?? ''}
            </Text>
          </div>

          <div className={styles.exhibitions}>
            <Button
              font="dashboard"
              variant="secondary"
              label="New exhibition"
              onClick={handleNewExhibition}
            />
            <div className={styles.list}>
              <Text font="dashboard" as="h2" className={styles.subtitle}>
                My exhibitions
              </Text>
              {exhibitions.length === 0 ? (
                <Text font="dashboard" as="p">
                  You do not have any exhibitions yet.
                </Text>
              ) : (
                <ul className={styles.exhibitionList}>
                  {exhibitions.map((ex: TExhibition) => (
                    <li key={ex.id} className={styles.exhibitionItem}>
                      {ex.mainTitle}{' '}
                      <Button
                        variant="secondary"
                        label="Edit"
                        onClick={() =>
                          router.push(`/${userData?.handler}/exhibition/${ex.url}/edit`)
                        }
                      />
                      <Button
                        variant="primary"
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
                spaceOptions={spaceOptions.filter((opt) => !opt.adminOnly)}
                userId={userData?.id ?? ''}
              />
            </Modal>
          )}

          <ErrorText>{error && `⚠️ ${JSON.stringify(error)}`}</ErrorText>
        </div>
      )}
      {isEditMode && <EditView />}
    </div>
  )
}
