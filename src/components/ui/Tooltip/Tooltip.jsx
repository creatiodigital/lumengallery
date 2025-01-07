import React, { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { setTooltipOpen } from '@/lib/features/dashboardSlice'

import styles from './Tooltip.module.scss'

const Tooltip = ({ label, children, id }) => {
  const [isVisible, setIsVisible] = useState(false)
  const timerRef = useRef(null)
  const dispatch = useDispatch()
  const { activeTooltipId, lastTooltipOpenedAt } = useSelector((state) => state.dashboard)

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const showTooltip = () => {
    clearTimers()

    const currentTime = Date.now()
    const threeSecondsAgo = currentTime - 3000

    if (!activeTooltipId && (!lastTooltipOpenedAt || lastTooltipOpenedAt < threeSecondsAgo)) {
      timerRef.current = setTimeout(() => {
        dispatch(setTooltipOpen({ isOpen: true, id }))
        setIsVisible(true)
      }, 1500)
    } else {
      dispatch(setTooltipOpen({ isOpen: true, id }))
      setIsVisible(true)
    }
  }

  const hideTooltip = () => {
    clearTimers()

    timerRef.current = setTimeout(() => {
      if (activeTooltipId === id) {
        dispatch(setTooltipOpen({ isOpen: false, id: null }))
      }
      setIsVisible(false)
    }, 0)
  }

  const handleMouseEnter = () => {
    showTooltip()
  }

  const handleMouseLeave = () => {
    hideTooltip()
  }

  return (
    <div className={styles.tooltip} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {isVisible && <div className={styles.content}>{label}</div>}
    </div>
  )
}

export default Tooltip
