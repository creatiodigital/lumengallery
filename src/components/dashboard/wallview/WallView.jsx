import React, { useState } from 'react'
import styles from './WallView.module.scss'
import { Wall } from '@/components/dashboard/wall/Wall'

export const WallView = ({ scaleFactor, panPosition, setPanPosition }) => {
  const handleWheel = (e) => {
    const scrollSpeedFactor = 0.4 // Increase this value to make the movement faster

    const deltaX = -e.deltaX * scrollSpeedFactor // Reverse direction
    const deltaY = -e.deltaY * scrollSpeedFactor // Reverse direction

    setPanPosition((prev) => ({
      x: prev.x + (deltaX / window.innerWidth) * 100,
      y: prev.y + (deltaY / window.innerHeight) * 100,
    }))
  }

  return (
    <div
      className={styles.wallView}
      onWheel={handleWheel} // Add the onWheel event listener here
    >
      <div
        id="wallWrapper"
        className={styles.wallWrapper}
        style={{
          transform: `translate(${panPosition.x}%, ${panPosition.y}%) scale(${scaleFactor || 1})`,
        }}
      >
        <Wall scaleFactor={scaleFactor} />
      </div>
    </div>
  )
}
