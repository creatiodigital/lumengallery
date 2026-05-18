'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/Button'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

import styles from './page.module.scss'

type Slide = {
  id: string
  order: number
  imageUrl: string
  title: string
  subtitle: string
  meta: string
  exhibitionUrl: string
  isActive: boolean
}

type SortableSlideItemProps = {
  slide: Slide
  onEdit: (slide: Slide) => void
  onDelete: (slide: Slide) => void
}

function SortableSlideItem({ slide, onEdit, onDelete }: SortableSlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.slideItem}>
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <span className={styles.dragIcon}>⠿</span>
      </div>
      <div className={styles.slidePreview}>
        {slide.imageUrl && (
          <img src={slide.imageUrl} alt={slide.title} className={styles.slideImage} />
        )}
      </div>
      <div className={styles.slideInfo}>
        <Text font="dashboard" as="h3">
          {slide.title}
        </Text>
        <Text font="dashboard" as="p" className={styles.subtitle}>
          {slide.subtitle}
        </Text>
        <Text font="dashboard" as="p" className={styles.meta}>
          {slide.meta}
        </Text>
      </div>
      <div className={styles.slideActions}>
        <Button font="dashboard" variant="secondary" label="Edit" onClick={() => onEdit(slide)} />
        <Button
          font="dashboard"
          variant="secondary"
          label="Delete"
          onClick={() => onDelete(slide)}
        />
      </div>
    </div>
  )
}

export default function LandingContentPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [isNewSlide, setIsNewSlide] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    } else if (status === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        router.push('/')
      }
    }
  }, [status, session, router])

  const fetchSlides = useCallback(async () => {
    try {
      const response = await fetch('/api/slides')
      const data = await response.json()
      setSlides(data)
    } catch (error) {
      console.error('Error fetching slides:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSlides()
  }, [fetchSlides])

  const handleAddSlide = () => {
    setEditingSlide({
      id: '',
      order: slides.length,
      imageUrl: '',
      title: '',
      subtitle: '',
      meta: '',
      exhibitionUrl: '',
      isActive: true,
    })
    setIsNewSlide(true)
    setUploadError(null)
  }

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide)
    setIsNewSlide(false)
    setUploadError(null)
  }

  const uploadImageToSlide = useCallback(async (file: File, slideId: string) => {
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch(`/api/slides/${slideId}/image`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        setUploadError(data.error || 'Failed to upload image')
        return
      }
      setEditingSlide((prev) => (prev ? { ...prev, imageUrl: data.url } : null))
    } catch (error) {
      console.error('Error uploading image:', error)
      setUploadError('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }, [])

  // ImageUploader's onUpload. For a brand-new slide we need a DB row to
  // attach the R2 image to, so create the slide first (empty fields are
  // fine — the user fills them in via the form and clicks Save).
  const handleSlideUpload = useCallback(
    async (file: File) => {
      if (!editingSlide) return
      if (isNewSlide && !editingSlide.id) {
        setSaving(true)
        setUploadError(null)
        try {
          const response = await fetch('/api/slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingSlide),
          })
          const savedSlide = await response.json()
          if (!response.ok) {
            setUploadError(savedSlide.error || 'Failed to create slide')
            return
          }
          setEditingSlide(savedSlide)
          setIsNewSlide(false)
          await uploadImageToSlide(file, savedSlide.id)
          await fetchSlides()
        } catch (error) {
          console.error('Error creating slide:', error)
          setUploadError('Failed to create slide')
        } finally {
          setSaving(false)
        }
      } else {
        await uploadImageToSlide(file, editingSlide.id)
      }
    },
    [editingSlide, isNewSlide, uploadImageToSlide, fetchSlides],
  )

  const handleSlideImageRemove = useCallback(async () => {
    if (!editingSlide?.id || !editingSlide.imageUrl) return
    setUploading(true)
    setUploadError(null)
    try {
      const response = await fetch(`/api/slides/${editingSlide.id}/image`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setUploadError(data.error || 'Failed to remove image')
        return
      }
      setEditingSlide((prev) => (prev ? { ...prev, imageUrl: '' } : null))
    } catch (error) {
      console.error('Error removing image:', error)
      setUploadError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [editingSlide?.id, editingSlide?.imageUrl])

  const handleSaveSlide = async () => {
    if (!editingSlide) return

    setSaving(true)
    try {
      const url = isNewSlide ? '/api/slides' : `/api/slides/${editingSlide.id}`
      const method = isNewSlide ? 'POST' : 'PUT'

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSlide),
      })

      await fetchSlides()
      setEditingSlide(null)
    } catch (error) {
      console.error('Error saving slide:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSlide = async () => {
    if (!deleteTarget) return

    try {
      await fetch(`/api/slides/${deleteTarget.id}`, { method: 'DELETE' })
      await fetchSlides()
      setDeleteTarget(null)
    } catch (error) {
      console.error('Error deleting slide:', error)
    }
  }

  const updateField = (field: keyof Slide, value: string | number | boolean) => {
    if (!editingSlide) return
    setEditingSlide({ ...editingSlide, [field]: value })
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)
      const newSlides = arrayMove(slides, oldIndex, newIndex)
      setSlides(newSlides)

      // Persist new order to the API
      try {
        await fetch('/api/slides/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slideIds: newSlides.map((s) => s.id),
          }),
        })
      } catch (error) {
        console.error('Error reordering slides:', error)
        // Refetch to restore server state on error
        fetchSlides()
      }
    }
  }

  if (status === 'loading' || loading) {
    return <div className={styles.page}>Loading...</div>
  }

  return (
    <DashboardLayout backLink="/admin/dashboard">
      <h1 className={dashboardStyles.pageTitle}>Landing Page - Slideshow</h1>

      <div className={dashboardStyles.sectionHeader}>
        <div></div>
        <Button font="dashboard" variant="primary" label="Add Slide" onClick={handleAddSlide} />
      </div>

      {slides.length === 0 ? (
        <Text font="dashboard" as="p" className={styles.empty}>
          No slides yet. Click &quot;Add Slide&quot; to create one.
        </Text>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.slideList}>
              {slides.map((slide) => (
                <SortableSlideItem
                  key={slide.id}
                  slide={slide}
                  onEdit={handleEditSlide}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit/Add Modal */}
      {editingSlide && (
        <Modal onClose={() => setEditingSlide(null)}>
          <div className={styles.modal}>
            <Text font="dashboard" as="h2">
              {isNewSlide ? 'Add Slide' : 'Edit Slide'}
            </Text>

            <div className={styles.section}>
              <label className={styles.label}>Image</label>
              <ImageUploader
                imageUrl={editingSlide.imageUrl || null}
                onUpload={handleSlideUpload}
                onRemove={editingSlide.id ? handleSlideImageRemove : undefined}
                uploading={uploading}
                error={uploadError}
                aspectRatio="16 / 9"
              />

              <label className={styles.label} htmlFor="title">
                Title
              </label>
              <Input
                id="title"
                size="medium"
                value={editingSlide.title}
                onChange={(e) => updateField('title', e.target.value)}
              />

              <label className={styles.label} htmlFor="subtitle">
                Subtitle
              </label>
              <Input
                id="subtitle"
                size="medium"
                value={editingSlide.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
              />

              <label className={styles.label} htmlFor="meta">
                Meta
              </label>
              <Input
                id="meta"
                size="medium"
                value={editingSlide.meta}
                onChange={(e) => updateField('meta', e.target.value)}
              />

              <label className={styles.label} htmlFor="exhibitionUrl">
                Exhibition URL
              </label>
              <Input
                id="exhibitionUrl"
                size="medium"
                value={editingSlide.exhibitionUrl}
                onChange={(e) => updateField('exhibitionUrl', e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setEditingSlide(null)}
              />
              <Button
                font="dashboard"
                variant="primary"
                label={saving ? 'Saving...' : 'Save'}
                onClick={handleSaveSlide}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={styles.modal}>
            <Text font="dashboard" as="h2">
              Delete Slide?
            </Text>
            <Text font="dashboard" as="p">
              Are you sure you want to delete the slide "{deleteTarget.title}"?
            </Text>
            <div className={styles.modalActions}>
              <Button
                font="dashboard"
                variant="primary"
                label="Yes, Delete"
                onClick={handleDeleteSlide}
              />
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setDeleteTarget(null)}
              />
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}
