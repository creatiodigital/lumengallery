'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

import { MoreVertical } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorText } from '@/components/ui/ErrorText'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { Modal } from '@/components/ui/Modal'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import { useEffectiveUser } from '@/hooks/useEffectiveUser'
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

import { DashboardLayout } from './DashboardLayout'
import { spaceOptions } from './constants'
import dashboardStyles from './DashboardLayout/DashboardLayout.module.scss'

export const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session } = useSession()
  const { effectiveUser, isImpersonating } = useEffectiveUser()

  // The effective user — the impersonated artist when an admin is impersonating.
  const userId = effectiveUser?.id
  const userHandler = effectiveUser?.handler

  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  // Owner-guarded read: the store is global and outlives a user switch, so this
  // returns nothing rather than the previous user's exhibitions.
  const exhibitions = useSelector((state: RootState) => selectExhibitionsForUser(state, userId))
  const [deleteExhibition] = useDeleteExhibitionMutation()

  const [isModalShown, setIsModalShown] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close kebab menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const { data: userData } = useGetUserQuery(userId ?? '', {
    skip: !userId,
  })
  const {
    data: exhibitionsData,
    // Which user this data was actually fetched FOR. Tagging the store with
    // this rather than with the current `userId` means a response that lands
    // after a user switch can never be filed under the wrong owner.
    originalArgs: exhibitionsOwnerId,
    isError: exhibitionsFailed,
    refetch: refetchExhibitions,
  } = useGetExhibitionsByUserQuery(userId ?? '', {
    skip: !userId,
  })

  const [createExhibition, { isLoading: creating, error }] = useCreateExhibitionMutation()

  useEffect(() => {
    if (exhibitionsData && exhibitionsOwnerId) {
      dispatch(hydrateExhibitions({ ownerId: exhibitionsOwnerId, exhibitions: exhibitionsData }))
    }
  }, [exhibitionsData, exhibitionsOwnerId, dispatch])

  // Refetch exhibitions when switching users (e.g. after admin deletes then impersonates)
  useEffect(() => {
    if (userId) {
      refetchExhibitions()
    }
  }, [userId, refetchExhibitions])

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
          userId: userId ?? '',
          userHandler: userHandler ?? '',
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
    [createExhibition, dispatch, userId, userHandler, selectedSpace, refetchExhibitions],
  )

  const handleDeleteClick = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteExhibition(deleteTarget.id).unwrap()
      dispatch(removeExhibition(deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete exhibition', err)
    } finally {
      setDeleting(false)
    }
  }, [deleteExhibition, dispatch, deleteTarget])

  const handleEdit3DSpace = useCallback(
    (exhibition: TExhibition) => {
      const artistSlug = userHandler ?? ''
      const exhibitionSlug = exhibition.url
      router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}/edit`)
    },
    [router, userHandler],
  )

  const handleEditExhibitionSettings = useCallback(
    (exhibition: TExhibition) => {
      router.push(`/dashboard/exhibitions/${exhibition.id}/settings`)
    },
    [router],
  )

  const handleViewExhibition = useCallback(
    (exhibition: TExhibition) => {
      const artistSlug = userHandler ?? ''
      const exhibitionSlug = exhibition.url
      router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}`)
    },
    [router, userHandler],
  )

  // Show "Back to Admin Dashboard" for admins/superadmins using test dashboard
  const userType = session?.user?.userType
  const isAdminOrSuperAdmin = userType === 'admin' || userType === 'superAdmin'
  const showBackToAdmin = isAdminOrSuperAdmin && !isImpersonating

  return (
    <DashboardLayout
      backLink={showBackToAdmin ? '/admin/dashboard' : undefined}
      backLabel={showBackToAdmin ? '← Back to Admin Dashboard' : undefined}
    >
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>
        Hello {userData?.name ?? session?.user?.name ?? ''}
      </h1>

      {/* Artist Profile Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>My Profile</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="Edit Profile"
            onClick={() => router.push('/dashboard/profile')}
          />
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Manage your artist profile, biography, and profile picture.
        </p>
      </div>

      {/* Payouts Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Payouts</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="Set up payouts"
            onClick={() => router.push('/dashboard/payouts')}
          />
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Connect a bank account with Stripe so we can send you your share when your prints sell.
        </p>
      </div>

      {/* Artwork Library Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>My Artworks</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="Manage Artworks"
            onClick={() => router.push('/dashboard/artworks')}
          />
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Upload and manage your artwork collection. Artworks can be used across multiple
          exhibitions.
        </p>
      </div>

      {/* Exhibitions Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>My Exhibitions</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="New Exhibition"
            onClick={handleNewExhibition}
          />
        </div>

        {/* A failed load used to be completely silent: the list simply stayed as
            it was, which is what let a stale one pass for the real thing. Say so
            instead — an empty list and a broken list are different facts. */}
        {exhibitionsFailed ? (
          <EmptyState message="Could not load exhibitions. Refresh the page to try again." />
        ) : exhibitions.length === 0 ? (
          <EmptyState message="You do not have any exhibitions yet." />
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Exhibition Name</th>
                <th>Space</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exhibitions.map((ex: TExhibition) => (
                <tr key={ex.id}>
                  <td>{ex.mainTitle}</td>
                  <td>{spaceOptions.find((s) => s.value === ex.spaceId)?.label || ex.spaceId}</td>
                  <td>
                    <Badge
                      label={ex.published ? 'Published' : 'Unpublished'}
                      variant={ex.published ? 'published' : 'unpublished'}
                    />
                  </td>
                  <td>
                    {ex.published && ex.hasPendingChanges ? (
                      <Badge label="Pending Changes" variant="current" />
                    ) : ex.published ? (
                      <Badge label="Up to date" variant="published" />
                    ) : null}
                  </td>
                  <td>
                    <div
                      className={dashboardStyles.kebabWrapper}
                      ref={openMenuId === ex.id ? menuRef : undefined}
                    >
                      <Button
                        variant="ghost"
                        className={dashboardStyles.kebabButton}
                        onClick={() => setOpenMenuId(openMenuId === ex.id ? null : ex.id)}
                        aria-label="Actions"
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === ex.id}
                      >
                        <MoreVertical size={16} strokeWidth={ICON_STROKE_WIDTH} />
                      </Button>
                      {openMenuId === ex.id && (
                        <div className={dashboardStyles.kebabMenu} role="menu">
                          <Button
                            variant="menuItem"
                            role="menuitem"
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              handleViewExhibition(ex)
                            }}
                            disabled={!ex.published}
                            label="View"
                          />
                          <Button
                            variant="menuItem"
                            role="menuitem"
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              handleEditExhibitionSettings(ex)
                            }}
                            label="Edit Exhibition"
                          />
                          <Button
                            variant="menuItem"
                            role="menuitem"
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              handleEdit3DSpace(ex)
                            }}
                            label="Edit 3D Space"
                          />
                          {isAdminOrSuperAdmin && (
                            <Button
                              variant="menuItem"
                              role="menuitem"
                              className={`${dashboardStyles.kebabMenuItem} ${dashboardStyles.kebabMenuItemDanger}`}
                              onClick={() => {
                                setOpenMenuId(null)
                                handleDeleteClick(ex.id, ex.mainTitle)
                              }}
                              label="Delete"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
            userId={userId ?? ''}
          />
        </Modal>
      )}

      <ErrorText>{error && `⚠️ ${JSON.stringify(error)}`}</ErrorText>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete Exhibition</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This will
              permanently remove the exhibition and all its data.
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.deleteActions}>
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setDeleteTarget(null)}
              />
              <Button
                font="dashboard"
                variant="primary"
                label={deleting ? 'Deleting...' : 'Delete'}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              />
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}
