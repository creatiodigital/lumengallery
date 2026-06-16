import {
  AlertCircle,
  Armchair,
  ArrowDownFromLine,
  ArrowLeft,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  ArrowRight,
  BrickWall,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  FolderDown,
  Headphones,
  House,
  Image,
  Info,
  LampCeiling,
  Link as LinkIcon,
  LoaderCircle,
  Lock,
  Magnet,
  Monitor,
  MoveHorizontal,
  MoveVertical,
  Music,
  PanelBottomDashed,
  PersonStanding,
  Play,
  Printer,
  Redo2,
  Ruler,
  Settings,
  Shapes,
  Square,
  Trash2,
  Type,
  Undo2,
  Video,
  Volume1,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { FC, SVGProps } from 'react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

// Custom SVG imports (for icons not available in Lucide)
import ChevronDown from '@/icons/chevron-down.svg'
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
import PositionBottom from '@/icons/position-bottom.svg'
import PositionCenterH from '@/icons/position-center-h.svg'
import PositionCenterV from '@/icons/position-center-v.svg'
import PositionLeft from '@/icons/position-left.svg'
import PositionRight from '@/icons/position-right.svg'
import PositionTop from '@/icons/position-top.svg'
import Preview from '@/icons/preview.svg'
import Reset from '@/icons/reset.svg'
import TextCenter from '@/icons/text-center.svg'
import TextLeft from '@/icons/text-left.svg'
import TextJustify from '@/icons/text-justify.svg'
import TextRight from '@/icons/text-right.svg'
import TextVerticalBottom from '@/icons/text-vertical-bottom.svg'
import TextVerticalCenter from '@/icons/text-vertical-center.svg'
import TextVerticalTop from '@/icons/text-vertical-top.svg'
import Text from '@/icons/text.svg'
import VerticalBottom from '@/icons/vertical-bottom.svg'
import VerticalCenter from '@/icons/vertical-center.svg'
import VerticalTop from '@/icons/vertical-top.svg'
import ZoomIn from '@/icons/zoom-in.svg'
import ZoomOut from '@/icons/zoom-out.svg'

// Type for custom SVG icons
type CustomSvgIcon = FC<SVGProps<SVGSVGElement>>

// Lucide icons registry (add Lucide icons here as needed)
const lucideIcons: Record<string, LucideIcon> = {
  'alert-circle': AlertCircle,
  armchair: Armchair,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowTopFromLine: ArrowUpFromLine,
  arrowBottomFromLine: ArrowDownFromLine,
  arrowLeftFromLine: ArrowLeftFromLine,
  arrowRightFromLine: ArrowRightFromLine,
  'brick-wall': BrickWall,
  camera: Camera,
  'check-circle': CheckCircle,
  close: X,
  eye: Eye,
  eyeOff: EyeOff,
  gallery: FolderDown,
  headphones: Headphones,
  house: House,
  'human-standing': PersonStanding,
  image: Image,
  info: Info,
  light: LampCeiling,
  link: LinkIcon,
  loaderCircle: LoaderCircle,
  lock: Lock,
  magnet: Magnet,
  monitor: Monitor,
  moveHorizontal: MoveHorizontal,
  moveVertical: MoveVertical,
  music: Music,
  'panel-bottom-dashed': PanelBottomDashed,
  play: Play,
  printer: Printer,
  redo: Redo2,
  ruler: Ruler,
  settings: Settings,
  shapes: Shapes,
  square: Square,
  'trash-2': Trash2,
  type: Type,
  undo: Undo2,
  video: Video,
  'volume-1': Volume1,
  'volume-2': Volume2,
}

// Custom SVG icons registry
const customIcons: Record<string, CustomSvgIcon> = {
  chevronDown: ChevronDown,
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
  positionLeft: PositionLeft,
  positionTop: PositionTop,
  positionBottom: PositionBottom,
  positionCenterV: PositionCenterV,
  positionCenterH: PositionCenterH,
  positionRight: PositionRight,
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
  textJustify: TextJustify,
  textVerticalTop: TextVerticalTop,
  textVerticalCenter: TextVerticalCenter,
  textVerticalBottom: TextVerticalBottom,
  verticalBottom: VerticalBottom,
  verticalCenter: VerticalCenter,
  verticalTop: VerticalTop,
}

// Merge both registries for type inference
const _allIcons = { ...lucideIcons, ...customIcons }

export type IconName = keyof typeof _allIcons

export type IconProps = {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}

const Icon = ({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = ICON_STROKE_WIDTH,
}: IconProps) => {
  // Check if it's a Lucide icon
  const LucideIconComponent = lucideIcons[name as keyof typeof lucideIcons]
  if (LucideIconComponent) {
    return <LucideIconComponent size={size} color={color} strokeWidth={strokeWidth} />
  }

  // Fallback to custom SVG icon
  const CustomIconComponent = customIcons[name as keyof typeof customIcons]
  if (CustomIconComponent) {
    return <CustomIconComponent width={size} height={size} fill={color} />
  }

  return null
}

export default Icon
