/**
 * Primary tab order for swipe navigation (left = next, right = previous).
 */
export const TAB_ORDER = ['calendar', 'book', 'clients']

/**
 * @param {string} currentTab
 * @param {'left' | 'right'} direction finger swipe direction
 * @returns {string | null}
 */
export function getAdjacentTab(currentTab, direction) {
  const index = TAB_ORDER.indexOf(currentTab)
  if (index < 0) return null
  if (direction === 'left') {
    return TAB_ORDER[index + 1] ?? null
  }
  if (direction === 'right') {
    return TAB_ORDER[index - 1] ?? null
  }
  return null
}

/**
 * Classify a completed touch gesture as a horizontal swipe, or null.
 * @param {{ startX: number, startY: number, endX: number, endY: number }} points
 * @param {{ threshold?: number, dominance?: number }} [options]
 * @returns {'left' | 'right' | null}
 */
export function classifyHorizontalSwipe(points, options = {}) {
  const threshold = options.threshold ?? 56
  const dominance = options.dominance ?? 1.25
  const dx = points.endX - points.startX
  const dy = points.endY - points.startY
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (absX < threshold) return null
  if (absX < absY * dominance) return null

  return dx < 0 ? 'left' : 'right'
}
