'use client'

import { useEffect } from 'react'

// Reads the saved UI palette from localStorage and applies it to <html data-theme>.
// This runs once on mount — no flash because the HTML default is data-theme="1".
export default function ThemeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem('ui-theme')
    if (saved && ['1', '2', '3'].includes(saved)) {
      document.documentElement.dataset.theme = saved
    }
  }, [])
  return null
}
