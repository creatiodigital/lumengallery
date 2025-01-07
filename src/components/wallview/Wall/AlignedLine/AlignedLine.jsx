import styles from './AlignedLine.module.scss'

const AlignedLine = ({ start, end, direction }) => {
  const isHorizontal =
    direction === 'horizontal' ||
    direction === 'top' ||
    direction === 'bottom' ||
    direction === 'center-horizontal'

  const lineStart = {
    x: isHorizontal
      ? Math.min(start.x, end.x)
      : direction === 'right'
        ? start.x + start.width
        : direction === 'center-vertical'
          ? start.x + start.width / 2
          : start.x,
    y: isHorizontal
      ? direction === 'bottom'
        ? start.y + start.height
        : direction === 'center-horizontal'
          ? start.y + start.height / 2
          : start.y
      : Math.min(start.y, end.y),
  }

  const lineEnd = {
    x: isHorizontal
      ? Math.max(start.x + start.width, end.x + end.width)
      : direction === 'right'
        ? end.x + end.width
        : direction === 'center-vertical'
          ? end.x + end.width / 2
          : end.x,
    y: isHorizontal
      ? direction === 'bottom'
        ? end.y + end.height
        : direction === 'center-horizontal'
          ? end.y + end.height / 2
          : end.y
      : Math.max(start.y + start.height, end.y + end.height),
  }

  const style = {
    width: isHorizontal ? `${lineEnd.x - lineStart.x}px` : '1px',
    height: isHorizontal ? '1px' : `${lineEnd.y - lineStart.y}px`,
    top: `${lineStart.y}px`,
    left: `${lineStart.x}px`,
  }

  return <div className={styles.line} style={style} />
}

export default AlignedLine
