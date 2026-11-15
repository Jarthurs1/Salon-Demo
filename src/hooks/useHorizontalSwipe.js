import { useEffect, useRef } from 'react'
import { classifyHorizontalSwipe } from '../utils/swipeNav.js'

/**
 * Attach horizontal swipe listeners to an element.
 * Ignores gestures that start inside `[data-swipe-isolate]`.
 */
export function useHorizontalSwipe(
  elementRef,
  { onSwipeLeft, onSwipeRight, enabled = true, threshold = 56 } = {},
) {
  const handlersRef = useRef({ onSwipeLeft, onSwipeRight })
  handlersRef.current = { onSwipeLeft, onSwipeRight }

  useEffect(() => {
    const el = elementRef?.current
    if (!el || !enabled) return undefined

    let startX = 0
    let startY = 0
    let tracking = false
    let isolated = false

    function onTouchStart(event) {
      if (event.touches.length !== 1) {
        tracking = false
        return
      }
      const target = event.target
      const isolate =
        target instanceof Element
          ? target.closest('[data-swipe-isolate]')
          : null
      // Ignore only when gesture starts in a nested isolate region (not this element).
      isolated = Boolean(isolate && isolate !== el)
      if (isolated) {
        tracking = false
        return
      }
      tracking = true
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
    }

    function onTouchEnd(event) {
      if (!tracking) return
      tracking = false
      const touch = event.changedTouches[0]
      if (!touch) return

      const direction = classifyHorizontalSwipe(
        {
          startX,
          startY,
          endX: touch.clientX,
          endY: touch.clientY,
        },
        { threshold },
      )
      if (!direction) return

      if (direction === 'left') handlersRef.current.onSwipeLeft?.()
      if (direction === 'right') handlersRef.current.onSwipeRight?.()
    }

    function onTouchCancel() {
      tracking = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [elementRef, enabled, threshold])
}
