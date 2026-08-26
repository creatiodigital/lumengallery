'use client'

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
import { Text } from '@/components/ui/Typography'
import type { AdminSelectionRow, SelectionStatus } from '@/lib/queries/getGallerySelection'

import styles from './GallerySelection.module.scss'

/**
 * What the curator is told about each entry. Sold out is NOT a problem state — it
 * stays on the page as proof the editions move — so it reads differently from a
 * work withdrawn from sale entirely.
 */
const REASON: Record<SelectionStatus, string | null> = {
  live: null,
  'sold-out': 'Sold out · shown on the page',
  'not-for-sale': 'Not for sale · hidden from the page',
}

function SortableRow({
  row,
  onRemove,
}: {
  row: AdminSelectionRow
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.selectionId,
  })
  const reason = REASON[row.status]

  return (
    <div
      ref={setNodeRef}
      data-selection-row
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={row.status === 'not-for-sale' ? `${styles.row} ${styles.rowHidden}` : styles.row}
    >
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <span className={styles.dragIcon}>⠿</span>
      </div>
      {row.artwork.imageUrl && <img src={row.artwork.imageUrl} alt="" className={styles.thumb} />}
      <div className={styles.rowInfo}>
        <Text font="dashboard" as="h3">
          {row.artwork.title || row.artwork.name}
        </Text>
        <Text font="dashboard" as="p" className={styles.rowMeta}>
          {row.artistName}
          {row.artwork.sale
            ? ` · ${row.artwork.sale.editionType === 'limited' ? 'Limited' : 'Open'}`
            : ''}
        </Text>
        {reason && (
          <Text font="dashboard" as="p" className={styles.rowReason}>
            {reason}
          </Text>
        )}
      </div>
      <Button
        font="dashboard"
        variant="secondary"
        label="Remove"
        onClick={() => onRemove(row.selectionId)}
      />
    </div>
  )
}

type Props = {
  rows: AdminSelectionRow[]
  onReorder: (ids: string[]) => void
  onRemove: (selectionId: string) => void
}

export const SelectionList = ({ rows, onReorder, onRemove }: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => r.selectionId === active.id)
    const newIndex = rows.findIndex((r) => r.selectionId === over.id)
    onReorder(arrayMove(rows, oldIndex, newIndex).map((r) => r.selectionId))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={rows.map((r) => r.selectionId)}
        strategy={verticalListSortingStrategy}
      >
        {rows.map((row) => (
          <SortableRow key={row.selectionId} row={row} onRemove={onRemove} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
