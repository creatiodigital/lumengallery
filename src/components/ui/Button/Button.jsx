import React, { useCallback } from 'react'

import styles from './Button.module.scss'

function Button(props) {
  const { children, disabled, type = 'button', onClick = () => {} } = props

  const handleClick = useCallback(() => {
    onClick()
  }, [onClick])

  return (
    <button className={styles.default} type={type} onClick={handleClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default Button
