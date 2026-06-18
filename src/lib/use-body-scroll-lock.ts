import { useEffect } from 'react'

/**
 * Lock background scroll while `locked` is true (e.g. a modal/overlay is open),
 * restoring the previous `document.body` overflow on unlock/unmount. Prevents
 * touch scrolls from dragging the page behind a fixed overlay on mobile.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
