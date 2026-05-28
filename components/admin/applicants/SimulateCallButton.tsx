'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SimulateCallButton({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ passed: boolean; totalScore: number } | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function handleSimulate() {
    if (!confirm('Simulate a completed screening call for this applicant? This uses real OpenAI scoring.')) return
    setState('loading')
    setErrMsg(null)
    const res = await fetch('/api/admin/test/simulate-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setErrMsg(json.error ?? 'Simulation failed')
      setState('error')
      return
    }
    setResult(json)
    setState('done')
    router.refresh()
  }

  if (state === 'done' && result) {
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded ${result.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        Simulated: {result.passed ? 'PASS' : 'FAIL'} ({result.totalScore}/100)
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSimulate}
        disabled={state === 'loading'}
        className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1 hover:border-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
      >
        {state === 'loading' ? 'Simulating…' : '⚗ Simulate Call'}
      </button>
      {state === 'error' && <span className="text-xs text-red-600">{errMsg}</span>}
    </div>
  )
}
