import Close from '@/icons/close.svg'
import Expand from '@/icons/expand.svg'
import Grid from '@/icons/grid.svg'
import Move from '@/icons/move.svg'
import Painting from '@/icons/painting.svg'
import Person from '@/icons/person.svg'
import Placeholder from '@/icons/placeholder.svg'
import Reset from '@/icons/reset.svg'
import Text from '@/icons/text.svg'
import ZoomIn from '@/icons/zoom-in.svg'
import ZoomOut from '@/icons/zoom-out.svg'

const icons = {
  close: Close,
  grid: Grid,
  expand: Expand,
  move: Move,
  painting: Painting,
  person: Person,
  placeholder: Placeholder,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  reset: Reset,
  text: Text,
}

const Icon = ({ name, size = 24, color = 'currentColor' }) => {
  const SvgIcon = icons[name]
  return SvgIcon ? <SvgIcon width={size} height={size} fill={color} /> : null
}

export default Icon
