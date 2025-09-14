import c from 'classnames'
import React from 'react'

import type { THandleDirection } from '@/types/wallView'

import styles from './Handle.module.scss'

type THandleProps = {
  direction: THandleDirection
  onMouseDown: React.MouseEventHandler<HTMLDivElement>
}

const Handle = ({ direction, onMouseDown }: THandleProps) => (
  <div className={c([styles.handle, styles[direction]])} onMouseDown={onMouseDown} />
)

export default Handle
