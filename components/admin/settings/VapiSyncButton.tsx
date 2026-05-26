'use client'

import { useState } from 'react'

export default function VapiSyncButton({ hasAssistantId }: { hasAssistantId: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [assistantId, setAssistantId] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function handleSync() {
    setState('loading')
    setErrMsg(null)
    const res = await fetch('/api/admin/vapi/sync', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setErrMsg(json.error ?? 'Sync failed')
      setState('error')
      return
    }
    setAssistantId(json.assistantId)
    setState('done')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {hasAssistantId ? 'Assistant configured' : 'No assistant configured'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {hasAssistantId
              ? 'Push updated system prompt and tools to Vapi.'
              : 'Create the Vapi assistant with the correct prompt and tools.'}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={state === 'loading'}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {state === 'loading' ? 'Syncing…' : hasAssistantId ? 'Re-sync Assistant' : 'Create Assistant'}
        </button>
      </div>

      {state === 'done' && assistantId && !hasAssistantId && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
          <p className="font-medium text-green-800">Assistant created!</p>
          <p className="text-green-700 mt-1">
            Add this to Vercel Environment Variables and redeploy:
          </p>
          <code className="block mt-2 bg-white border border-green-200 rounded px-2 py-1 text-xs font-mono text-gray-800 select-all">
            VAPI_ASSISTANT_ID={assistantId}
          </code>
        </div>
      )}

      {state === 'done' && hasAssistantId && (
        <p className="text-sm text-green-700">Assistant updated successfully.</p>
      )}

      {state === 'error' && (
        <p className="text-sm text-red-600">{errMsg}</p>
      )}
    </div>
  )
}
