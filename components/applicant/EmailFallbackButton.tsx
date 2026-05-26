'use client'

import { useState } from 'react'

export default function EmailFallbackButton({
  applicationId,
  email,
}: {
  applicationId: string
  email: string
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  async function handleSend() {
    setState('loading')
    const res = await fetch('/api/apply/resend-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, email }),
    })
    setState(res.ok ? 'sent' : 'error')
  }

  if (state === 'sent') {
    return <p className="text-sm text-green-700 font-medium">Link sent to {email} ✓</p>
  }

  return (
    <div className="text-center">
      <button
        onClick={handleSend}
        disabled={state === 'loading'}
        className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
      >
        {state === 'loading' ? 'Sending…' : "Text not arriving? Send link to my email instead"}
      </button>
      {state === 'error' && (
        <p className="mt-1 text-xs text-red-600">Something went wrong — please try again.</p>
      )}
    </div>
  )
}
