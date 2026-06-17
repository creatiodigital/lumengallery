'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { MoreVertical } from 'lucide-react'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string
  spaceId: string
  status: string
  published: boolean
  hasPendingChanges: boolean
  previewEnabled: boolean
  previewToken: string | null
  user: {
    id: string
    name: string
    lastName: string
    handler: string
    published?: boolean
  }
}

export const AdminExhibitions = () => {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Exhibition | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmText, setConfirmText] = useState('')
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

  const fetchExhibitions = useCallback(async () => {
    try {
      const response = await fetch('/api/exhibitions')
      if (response.ok) {
        const data = await response.json()
        setExhibitions(data)
      }
    } catch (error) {
      console.error('Failed to fetch exhibitions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExhibitions()
  }, [fetchExhibitions])

  const handleToggleStatus = async (exhibitionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'current' ? 'past' : 'current'
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handlePublishAction = async (exhibitionId: string, action: 'publish' | 'unpublish') => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: action === 'publish' }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update published status:', error)
    }
  }

  const handleUpdatePreviewExhibition = async (exhibitionId: string) => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasPendingChanges: false }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update preview exhibition:', error)
    }
  }

  const handleTogglePreview = async (exhibitionId: string, currentlyEnabled: boolean) => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewEnabled: !currentlyEnabled }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to toggle preview:', error)
    }
  }

  const handleCopyPreviewLink = (exhibition: Exhibition) => {
    const baseUrl = window.location.origin
    const visitUrl = `${baseUrl}/exhibitions/${exhibition.user.handler}/${exhibition.url}/visit?preview=${exhibition.previewToken}`
    navigator.clipboard.writeText(visitUrl)
  }

  const handleUpdatePreviewLink = async (exhibitionId: string) => {
    try {
      // Re-enable preview to generate a new token (old link becomes invalid)
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewEnabled: true }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update preview link:', error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setDeleteError('')
    try {
      const response = await fetch(`/api/exhibitions/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchExhibitions()
        setDeleteTarget(null)
        setConfirmText('')
      } else {
        const data = await response.json()
        setDeleteError(data.error || 'Failed to delete exhibition')
      }
    } catch (error) {
      console.error('Failed to delete exhibition:', error)
      setDeleteError('Failed to delete exhibition')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div>Loading exhibitions...</div>

  return (
    <>
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Exhibition Management</h2>
        </div>

        <table className={dashboardStyles.table}>
          <thead>
            <tr>
              <th>Exhibition</th>
              <th>Artist</th>
              <th>Space</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>Preview</th>
              <th>Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exhibitions.map((exhibition) => (
              <tr key={exhibition.id}>
                <td>
                  <Link href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}>
                    {exhibition.mainTitle}
                  </Link>
                </td>
                <td>
                  {exhibition.user.name} {exhibition.user.lastName}
                </td>
                <td>
                  {spaceConfigs[exhibition.spaceId as SpaceKey]?.displayName || exhibition.spaceId}
                </td>
                <td>
                  <Badge
                    label={exhibition.status}
                    variant={exhibition.status as 'current' | 'past'}
                  />
                </td>
                <td>
                  <Badge
                    label={exhibition.published ? 'Published' : 'Unpublished'}
                    variant={exhibition.published ? 'published' : 'unpublished'}
                  />
                </td>
                <td>
                  {!exhibition.published && (
                    <Badge
                      label={exhibition.previewEnabled ? 'Active' : '—'}
                      variant={exhibition.previewEnabled ? 'published' : 'unpublished'}
                    />
                  )}
                </td>
                <td>
                  {(exhibition.published || exhibition.previewEnabled) && (
                    <Badge
                      label={exhibition.hasPendingChanges ? 'Needs Review' : 'Up to date'}
                      variant={exhibition.hasPendingChanges ? 'current' : 'published'}
                    />
                  )}
                </td>
                <td>
                  <div
                    className={dashboardStyles.kebabWrapper}
                    ref={openMenuId === exhibition.id ? menuRef : undefined}
                  >
                    <Button
                      variant="ghost"
                      className={dashboardStyles.kebabButton}
                      onClick={() =>
                        setOpenMenuId(openMenuId === exhibition.id ? null : exhibition.id)
                      }
                      aria-label="Actions"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === exhibition.id}
                    >
                      <MoreVertical size={16} strokeWidth={ICON_STROKE_WIDTH} />
                    </Button>
                    {openMenuId === exhibition.id && (
                      <div className={dashboardStyles.kebabMenu} role="menu">
                        <Button
                          variant="menuItem"
                          role="menuitem"
                          className={dashboardStyles.kebabMenuItem}
                          onClick={() => {
                            setOpenMenuId(null)
                            handleToggleStatus(exhibition.id, exhibition.status)
                          }}
                          label={exhibition.status === 'current' ? 'Mark Past' : 'Mark Current'}
                        />
                        {/* Publish / Update Exhibition */}
                        {(!exhibition.published || exhibition.hasPendingChanges) && (
                          <Button
                            variant="menuItem"
                            role="menuitem"
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              if (exhibition.hasPendingChanges && !exhibition.published) {
                                handleUpdatePreviewExhibition(exhibition.id)
                              } else {
                                handlePublishAction(exhibition.id, 'publish')
                              }
                            }}
                            disabled={
                              !exhibition.published &&
                              !exhibition.previewEnabled &&
                              !exhibition.user.published
                            }
                            label={exhibition.hasPendingChanges ? 'Update Exhibition' : 'Publish'}
                          />
                        )}
                        {/* Unpublish — always available when published */}
                        {exhibition.published && (
                          <Button
                            variant="menuItem"
                            role="menuitem"
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              handlePublishAction(exhibition.id, 'unpublish')
                            }}
                            label="Unpublish"
                          />
                        )}
                        {/* Publish / Unpublish Preview — only for unpublished exhibitions */}
                        {!exhibition.published && (
                          <Button
                            variant="menuItem"
                            role="menuitem"
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              handleTogglePreview(exhibition.id, exhibition.previewEnabled)
                            }}
                            label={
                              exhibition.previewEnabled ? 'Unpublish Preview' : 'Publish Preview'
                            }
                          />
                        )}
                        {/* Copy Preview Link — only when preview is active */}
                        {!exhibition.published &&
                          exhibition.previewEnabled &&
                          exhibition.previewToken && (
                            <Button
                              variant="menuItem"
                              role="menuitem"
                              className={dashboardStyles.kebabMenuItem}
                              onClick={() => {
                                setOpenMenuId(null)
                                handleCopyPreviewLink(exhibition)
                              }}
                              label="Copy Preview Link"
                            />
                          )}
                        {/* Update Preview Link — regenerate token (old link becomes invalid) */}
                        {!exhibition.published &&
                          exhibition.previewEnabled &&
                          exhibition.previewToken && (
                            <Button
                              variant="menuItem"
                              role="menuitem"
                              className={dashboardStyles.kebabMenuItem}
                              onClick={() => {
                                setOpenMenuId(null)
                                handleUpdatePreviewLink(exhibition.id)
                              }}
                              label="Update Preview Link"
                            />
                          )}
                        <Button
                          variant="menuItem"
                          role="menuitem"
                          className={`${dashboardStyles.kebabMenuItem} ${dashboardStyles.kebabMenuItemDanger}`}
                          onClick={() => {
                            setOpenMenuId(null)
                            setDeleteError('')
                            setDeleteTarget(exhibition)
                          }}
                          label="Delete"
                        />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          onClose={() => {
            setDeleteTarget(null)
            setConfirmText('')
            setDeleteError('')
          }}
        >
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete Exhibition</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.mainTitle}</strong> by{' '}
              {deleteTarget.user.name} {deleteTarget.user.lastName}?
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.confirmInput}>
              <label htmlFor="confirm-delete">
                Type <strong>CONFIRM</strong> to enable deletion:
              </label>
              <Input
                id="confirm-delete"
                type="text"
                variant="table"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            <ErrorText>{deleteError}</ErrorText>
            <div className={dashboardStyles.deleteActions}>
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => {
                  setDeleteTarget(null)
                  setConfirmText('')
                  setDeleteError('')
                }}
              />
              <Button
                font="dashboard"
                variant="primary"
                label={deleting ? 'Deleting...' : 'Delete'}
                onClick={handleDeleteConfirm}
                disabled={deleting || confirmText !== 'CONFIRM'}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
