import { LeftPanel } from '@/components/wallview/LeftPanel'
import { RightPanel } from '@/components/wallview/RightPanel'
import { CenterPanel } from '@/components/wallview/CenterPanel'

import styles from './WallView.module.scss'

export const WallView = () => {
  return (
    <div className={styles.wallView}>
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
    </div>
  )
}
