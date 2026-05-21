'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HireButton({
  applicationId,
  applicantName,
  alreadyHired,
}: {
  applicationId: string
  applicantName: string
  alreadyHired: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(alreadyHired)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleHire() {
    if (!confirm(`Mark ${applicantName} as hired? This will schedule 30/60/90-day retention check-ins.`)) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/applications/${applicationId}/hire`, { method: 'POST' })
    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to mark as hired')
      return
    }

    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700">
        ✓ Hired — retention check-ins scheduled
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleHire}
        disabled={loading}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Marking hired…' : '🎉 Mark as Hired'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
