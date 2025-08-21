import type { ReactNode } from 'react'

type ModalProps = {
  children: ReactNode
}

import styles from './Modal.module.scss'
const Modal = ({ children }: ModalProps) => {
  return (
    <div className={styles.modal}>
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default Modal
