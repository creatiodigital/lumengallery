import type { ReactNode, MouseEvent } from 'react'

type ModalProps = {
  children: ReactNode
  onClose: () => void
}

import styles from './Modal.module.scss'

const Modal = ({ children, onClose }: ModalProps) => {
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.modal} onClick={handleBackdropClick}>
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default Modal
