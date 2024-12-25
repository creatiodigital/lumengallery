'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { EditView } from '@/components/editview'
import { Button } from '@/components/ui/Button'
import { setHandler } from '@/lib/features/artistSlice'
import { showEditMode } from '@/lib/features/dashboardSlice'

import styles from './Dashboard.module.scss'

export const Dashboard = () => {
  const dispatch = useDispatch()
  const pathname = usePathname()
  const handler = pathname?.split('/')[1]
  const isEditMode = useSelector((state) => state.dashboard.isEditMode)

  useEffect(() => {
    if (handler) {
      dispatch(setHandler(handler))
    }
  }, [handler, dispatch])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  return (
    <div className={styles.dashboard}>
      {!isEditMode && (
        <div className={styles.main}>
          <div className={styles.left}>
            <Button
              className={styles.edit}
              type="small"
              onClick={handleEditGallery}
              label="Edit Exhibition"
            />
          </div>
        </div>
      )}
      {isEditMode && <EditView />}
    </div>
  )
}
