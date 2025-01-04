import styles from './AlignedLine.module.scss'

const AlignedLine = ({ start, end, direction }) => {
  const isHorizontal = direction === 'horizontal'

  const lineStart = {
    x: isHorizontal ? Math.min(start.x, end.x) : start.x,
    y: isHorizontal ? start.y : Math.min(start.y, end.y),
  }

  const lineEnd = {
    x: isHorizontal ? Math.max(start.x + start.width, end.x + end.width) : start.x,
    y: isHorizontal ? start.y : Math.max(start.y + start.height, end.y + end.height),
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
