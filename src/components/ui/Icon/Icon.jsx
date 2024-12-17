import Expand from '@/icons/expand.svg'
import Move from '@/icons/move.svg'

const icons = {
  expand: Expand,
  move: Move,
}

const Icon = ({ name, size = 24, color = 'currentColor' }) => {
  const SvgIcon = icons[name]
  return SvgIcon ? <SvgIcon width={size} height={size} fill={color} /> : null
}

export default Icon
