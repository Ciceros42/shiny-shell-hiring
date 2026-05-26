'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewSetButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleCreate() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/questions', { method: 'POST', body: JSON.stringify({}) })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? `Error ${res.status}`)
        setLoading(false)
        return
      }
      router.push(`/questions/${json.id}`)
    } catch (e) {
      setErr(String(e))
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating…' : '+ New Question Set'}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}
