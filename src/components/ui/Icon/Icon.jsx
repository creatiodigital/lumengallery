import Close from '@/icons/close.svg'
import Drop from '@/icons/drop.svg'
import Expand from '@/icons/expand.svg'
import Grid from '@/icons/grid.svg'
import Move from '@/icons/move.svg'
import Painting from '@/icons/painting.svg'
import Person from '@/icons/person.svg'
import Picture from '@/icons/picture.svg'
import Placeholder from '@/icons/placeholder.svg'
import Reset from '@/icons/reset.svg'
import Text from '@/icons/text.svg'
import TextCenter from '@/icons/text-center.svg'
import TextLeft from '@/icons/text-left.svg'
import TextRight from '@/icons/text-right.svg'
import ZoomIn from '@/icons/zoom-in.svg'
import ZoomOut from '@/icons/zoom-out.svg'

const icons = {
  close: Close,
  drop: Drop,
  grid: Grid,
  expand: Expand,
  move: Move,
  painting: Painting,
  person: Person,
  picture: Picture,
  placeholder: Placeholder,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  reset: Reset,
  text: Text,
  textLeft: TextLeft,
  textCenter: TextCenter,
  textRight: TextRight,
}

const Icon = ({ name, size = 24, color = 'currentColor' }) => {
  const SvgIcon = icons[name]
  return SvgIcon ? <SvgIcon width={size} height={size} fill={color} /> : null
}

export default Icon
