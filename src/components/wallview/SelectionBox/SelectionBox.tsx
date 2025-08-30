import React from 'react'

import styles from './SelectionBox.module.scss'

export type TSelectionBox = {
  selectionBox: {
    startX: number
    endX: number
    startY: number
    endY: number
  }
  scaleFactor: number
}

const SelectionBox = ({ selectionBox, scaleFactor }: TSelectionBox) => (
  <div
    className={styles.selectionBox}
    style={{
      left: `${Math.min(selectionBox.startX, selectionBox.endX) * scaleFactor}px`,
      top: `${Math.min(selectionBox.startY, selectionBox.endY) * scaleFactor}px`,
      width: `${Math.abs(selectionBox.endX - selectionBox.startX) * scaleFactor}px`,
      height: `${Math.abs(selectionBox.endY - selectionBox.startY) * scaleFactor}px`,
    }}
  ></div>
)

export default SelectionBox
