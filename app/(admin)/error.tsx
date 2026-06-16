'use client'

import { useEffect } from 'react'

// Catches uncaught errors thrown while rendering any admin page (e.g. a transient
// auth/profile lookup failure surfaced by requireAdmin). Shows a recoverable retry
// UI instead of a raw "server error" screen or an unwanted logout.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to the console (and Sentry, which auto-instruments errors).
    console.error('[admin] render error:', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="max-w-md w-full rounded-xl border p-8 text-center"
        style={{
          backgroundColor: 'var(--ui-card-bg)',
          borderColor: 'var(--ui-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--ui-accent-muted)', color: 'var(--ui-accent)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--ui-text-primary)' }}>
          Something went wrong
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ui-text-secondary)' }}>
          This page couldn&apos;t load. It&apos;s usually a temporary hiccup — try again.
        </p>
        <button
          onClick={() => reset()}
          className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          style={{ backgroundColor: 'var(--ui-accent)', color: 'var(--ui-accent-fg)' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
