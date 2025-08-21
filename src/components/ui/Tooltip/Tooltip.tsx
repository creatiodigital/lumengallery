import React, { useState, useRef, type ReactNode } from 'react'

import styles from './Tooltip.module.scss'

type TooltipProps = {
  label: string
  children: ReactNode
  top?: number
}

const Tooltip = ({ label, children, top = -5 }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = () => {
    timerRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 1000)
  }

  const hideTooltip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setIsVisible(false)
  }

  return (
    <div className={styles.tooltip} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      {isVisible && (
        <div className={styles.content} style={{ top }}>
          {label}
        </div>
      )}
    </div>
  )
}

export default Tooltip
