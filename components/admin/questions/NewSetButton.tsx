'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewSetButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    const res = await fetch('/api/admin/questions', { method: 'POST', body: JSON.stringify({}) })
    if (res.ok) {
      const { id } = await res.json()
      router.push(`/questions/${id}`)
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Creating…' : '+ New Question Set'}
    </button>
  )
}
