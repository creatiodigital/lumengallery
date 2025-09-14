import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

export const useGroupDetails = () => {
  const groupProperties = useSelector((state: RootState) => state.wallView.artworkGroup)

  const { groupX, groupY } = groupProperties

  return {
    groupX: Math.round(groupX),
    groupY: Math.round(groupY),
  }
}
