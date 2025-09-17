'use client'

import { useRouter } from 'next/navigation'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
// import { hideEditMode } from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { useGetUserQuery } from '@/redux/slices/userApi'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

const hardcodedId = '915a1541-f132-4fd1-a714-e34527485054'

export const Menu = () => {
  const dispatch = useDispatch()
  const router = useRouter()

  const { data: userData } = useGetUserQuery(hardcodedId)

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)

  const togglePlaceholders = () => {
    if (isPlaceholdersShown) {
      dispatch(hidePlaceholders())
    } else {
      dispatch(showPlaceholders())
    }
  }

  const handleClose = () => {
    router.push(`/${userData?.handler}/dashboard`)
  }

  return (
    <div className={styles.menu}>
      <ButtonIcon
        icon="close"
        onClick={handleClose}
        // onClick={() => dispatch(hideEditMode())}
      />
      <ButtonIcon
        icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
        onClick={() => togglePlaceholders()}
      />
    </div>
  )
}

export default Menu
