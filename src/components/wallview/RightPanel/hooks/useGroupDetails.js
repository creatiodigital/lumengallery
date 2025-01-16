import { useSelector } from 'react-redux'

export const useGroupDetails = () => {
  const groupProperties = useSelector((state) => state.wallView.artworkGroup)

  const { groupX, groupY } = groupProperties

  return {
    groupX: Math.round(groupX),
    groupY: Math.round(groupY),
  }
}
