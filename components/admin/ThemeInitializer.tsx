'use client'

import { useEffect } from 'react'

const INTERACTIVE = 'button:not(:disabled), a[href], [role="button"], [role="switch"], [role="tab"]'

// Cubic-bezier that overshoots slightly (spring/bulge on release)
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export default function ThemeInitializer() {
  useEffect(() => {
    // Restore saved palette
    const saved = localStorage.getItem('ui-theme')
    if (saved && ['1', '2', '3'].includes(saved)) {
      document.documentElement.dataset.theme = saved
    }

    // Global click-press animation.
    // Uses inline styles (highest specificity) so it works on every element
    // regardless of existing Tailwind transition classes.
    function onPointerDown(e: PointerEvent) {
      const el = (e.target as Element).closest<HTMLElement>(INTERACTIVE)
      if (!el) return

      // Press in — fast, linear
      el.style.transform = 'scale(0.94)'
      el.style.transition = 'transform 80ms ease'

      function restore() {
        if (!el) return
        // Spring back with slight overshoot (the "bulge")
        el.style.transform = ''
        el.style.transition = `transform 350ms ${SPRING}`
        // Clean up inline styles once the spring settles
        setTimeout(() => {
          if (!el) return
          el.style.transform = ''
          el.style.transition = ''
        }, 360)
      }

      el.addEventListener('pointerup', restore, { once: true })
      el.addEventListener('pointercancel', restore, { once: true })
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return null
}
