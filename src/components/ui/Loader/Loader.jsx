import { Html } from '@react-three/drei'

import { Icon } from '@/components/ui/Icon'

import styles from './Loader.module.scss'

const Loader = () => {
  return (
    <Html center>
      <div className={styles.loader}>
        <div className={styles.icon}>
          <Icon name="loading" size={36} color="#333333" />
        </div>
      </div>
    </Html>
  )
}

export default Loader
