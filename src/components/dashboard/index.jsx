'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { EditView } from '@/components/editview'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { setHandler } from '@/lib/features/artistSlice'
import { showEditMode, selectSpace } from '@/lib/features/dashboardSlice'

import { spaceOptions } from './constants'
import styles from './Dashboard.module.scss'

export const Dashboard = () => {
  const dispatch = useDispatch()
  const pathname = usePathname()
  const handler = pathname?.split('/')[1]
  const isEditMode = useSelector((state) => state.dashboard.isEditMode)
  const selectedSpace = useSelector((state) => state.dashboard.selectedSpace)

  useEffect(() => {
    if (handler) {
      dispatch(setHandler(handler))
    }
  }, [handler, dispatch])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  const handleSelectSpace = (space) => {
    dispatch(selectSpace(space))
  }

  return (
    <div className={styles.dashboard}>
      {!isEditMode && (
        <div className={styles.main}>
          <div className={styles.spaces}>
            <h2>Choose a Space</h2>
            <Select
              options={spaceOptions}
              onSelect={handleSelectSpace}
              selectedLabel={selectedSpace}
              size="medium"
            />
          </div>
          <div>
            <Button type="small" onClick={handleEditGallery} label="Create Exhibition" />
          </div>
        </div>
      )}
      {isEditMode && <EditView />}
    </div>
  )
}
