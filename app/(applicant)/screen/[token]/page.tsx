'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type ScreenState = 'idle' | 'loading' | 'calling' | 'expired' | 'already-done' | 'error'

export default function ScreenPage() {
  const params = useParams()
  const token = params.token as string
  const [state, setState] = useState<ScreenState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // If the page is opened — immediately try to initiate the call
  useEffect(() => {
    initiateCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function initiateCall() {
    setState('loading')
    try {
      const res = await fetch(`/api/screen/${token}`, { method: 'POST' })
      const data = await res.json()

      if (res.status === 410 || data.error === 'expired') {
        setState('expired')
        return
      }
      if (res.status === 409 || data.error === 'already-done') {
        setState('already-done')
        return
      }
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      setState('calling')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 h-16 w-16 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Connecting your call…</h2>
        <p className="mt-2 text-gray-500">This takes just a moment.</p>
      </div>
    )
  }

  if (state === 'calling') {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Your phone is ringing!</h2>
        <p className="mt-3 max-w-xs text-gray-600">
          Answer the call — it&apos;s us! The screening takes about 3 minutes.
        </p>
        <div className="mt-6 rounded-lg bg-blue-50 px-5 py-4 text-sm text-blue-700">
          <p className="font-medium">Tips for a great screening:</p>
          <ul className="mt-2 space-y-1 text-left text-blue-600">
            <li>• Find a quiet spot</li>
            <li>• Answer honestly — the AI is just getting to know you</li>
            <li>• Speak clearly and at a normal pace</li>
          </ul>
        </div>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
          <svg className="h-10 w-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">This link has expired</h2>
        <p className="mt-3 max-w-xs text-gray-600">
          Screening links are valid for 24 hours. If you&apos;re still interested, we may reach out
          when a new opening comes up.
        </p>
      </div>
    )
  }

  if (state === 'already-done') {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">You&apos;re all set!</h2>
        <p className="mt-3 max-w-xs text-gray-600">
          Your screening is already complete. Keep an eye on your texts for next steps.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
        <p className="mt-3 max-w-xs text-gray-600">{errorMsg}</p>
        <button
          onClick={initiateCall}
          className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    )
  }

  // idle — should not normally render since useEffect fires immediately
  return null
}
