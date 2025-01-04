import styles from './AlignedLine.module.scss'

const AlignedLine = ({ start, end, direction }) => {
  // Consider `top` and `bottom` as horizontal directions
  const isHorizontal = direction === 'horizontal' || direction === 'top' || direction === 'bottom'

  console.log('direction', direction)

  const lineStart = {
    x: isHorizontal
      ? Math.min(start.x, end.x) // Horizontal alignment: left or right
      : direction === 'right'
        ? start.x + start.width // Start at the right border
        : start.x, // Start at the left border
    y: isHorizontal
      ? direction === 'bottom'
        ? start.y + start.height // Start at the bottom border
        : start.y // Start at the top border
      : Math.min(start.y, end.y), // Vertical alignment: top or bottom
  }

  const lineEnd = {
    x: isHorizontal
      ? Math.max(start.x + start.width, end.x + end.width) // Horizontal alignment: extend to the right
      : direction === 'right'
        ? end.x + end.width // Extend to the right border
        : end.x, // Extend to the left border
    y: isHorizontal
      ? direction === 'bottom'
        ? end.y + end.height // Extend to the bottom border
        : end.y // Extend to the top border
      : Math.max(start.y + start.height, end.y + end.height), // Vertical alignment: extend to the bottom
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
