import { CenterPanel } from '@/components/wallview/CenterPanel'
import { CreatePanel } from '@/components/wallview/CreatePanel'
import { LeftPanel } from '@/components/wallview/LeftPanel'
import { RightPanel } from '@/components/wallview/RightPanel'

import styles from './WallView.module.scss'

export const WallView = () => {
  return (
    <div className={styles.wallView}>
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
      <CreatePanel />
    </div>
  )
}
