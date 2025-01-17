import ChevronDown from '@/icons/chevron-down.svg'
import Close from '@/icons/close.svg'
import DistributeHorizontal from '@/icons/distribute-horizontal.svg'
import DistributeVertical from '@/icons/distribute-vertical.svg'
import Drop from '@/icons/drop.svg'
import Expand from '@/icons/expand.svg'
import Grid from '@/icons/grid.svg'
import HorizontalCenter from '@/icons/horizontal-center.svg'
import HorizontalLeft from '@/icons/horizontal-left.svg'
import HorizontalRight from '@/icons/horizontal-right.svg'
import Loading from '@/icons/loading.svg'
import Move from '@/icons/move.svg'
import Painting from '@/icons/painting.svg'
import Person from '@/icons/person.svg'
import Picture from '@/icons/picture.svg'
import Placeholder from '@/icons/placeholder.svg'
import Preview from '@/icons/preview.svg'
import Reset from '@/icons/reset.svg'
import TextCenter from '@/icons/text-center.svg'
import TextLeft from '@/icons/text-left.svg'
import TextRight from '@/icons/text-right.svg'
import Text from '@/icons/text.svg'
import VerticalBottom from '@/icons/vertical-bottom.svg'
import VerticalCenter from '@/icons/vertical-center.svg'
import VerticalTop from '@/icons/vertical-top.svg'
import ZoomIn from '@/icons/zoom-in.svg'
import ZoomOut from '@/icons/zoom-out.svg'

const icons = {
  chevronDown: ChevronDown,
  close: Close,
  distributeHorizontal: DistributeHorizontal,
  distributeVertical: DistributeVertical,
  drop: Drop,
  grid: Grid,
  horizontalLeft: HorizontalLeft,
  horizontalCenter: HorizontalCenter,
  horizontalRight: HorizontalRight,
  expand: Expand,
  loading: Loading,
  move: Move,
  painting: Painting,
  person: Person,
  preview: Preview,
  picture: Picture,
  placeholder: Placeholder,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  reset: Reset,
  text: Text,
  textLeft: TextLeft,
  textCenter: TextCenter,
  textRight: TextRight,
  verticalBottom: VerticalBottom,
  verticalCenter: VerticalCenter,
  verticalTop: VerticalTop,
}

const Icon = ({ name, size = 24, color = 'currentColor' }) => {
  const SvgIcon = icons[name]
  return SvgIcon ? <SvgIcon width={size} height={size} fill={color} /> : null
}

export default Icon
