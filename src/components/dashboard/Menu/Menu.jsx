'use client'

import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { hideEditMode } from '@/lib/features/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/lib/features/sceneSlice'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)

  const togglePlaceholders = () => {
    if (isPlaceholdersShown) {
      dispatch(hidePlaceholders())
    } else {
      dispatch(showPlaceholders())
    }
  }

  return (
    <div className={styles.menu}>
      <ButtonIcon icon="close" onClick={() => dispatch(hideEditMode())} />
      <ButtonIcon icon="placeholder" onClick={() => togglePlaceholders()} />
    </div>
  )
}

export default Menu
