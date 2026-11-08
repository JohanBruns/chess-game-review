import { useRef } from 'react'

// A quick horizontal finger swipe → onSwipeLeft / onSwipeRight (touch only — a mouse drag on the
// board stays the library's arrow drawing). Mostly-vertical moves are left alone, so the page
// still scrolls under the finger.
const MIN_DISTANCE_PX = 40
const MAX_DURATION_MS = 600

export function useSwipe({
  enabled,
  onSwipeLeft,
  onSwipeRight,
}: {
  enabled: boolean
  onSwipeLeft: () => void
  onSwipeRight: () => void
}) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)

  return {
    onTouchStart(e: React.TouchEvent) {
      const touch = e.touches[0]
      startRef.current = enabled && e.touches.length === 1 && touch
        ? { x: touch.clientX, y: touch.clientY, t: e.timeStamp }
        : null
    },
    onTouchEnd(e: React.TouchEvent) {
      const start = startRef.current
      startRef.current = null
      const touch = e.changedTouches[0]
      if (!enabled || !start || !touch || e.timeStamp - start.t > MAX_DURATION_MS) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) onSwipeLeft()
      else onSwipeRight()
    },
  }
}
