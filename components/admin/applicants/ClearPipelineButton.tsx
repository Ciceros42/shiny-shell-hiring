'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearPipelineButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setInput('')
    setError(null)
    setOpen(true)
  }

  function closeModal() {
    if (loading) return
    setOpen(false)
    setInput('')
    setError(null)
  }

  async function handleClear() {
    if (input.trim().toUpperCase() !== 'YES') return
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/applications/clear-pipeline', { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      setOpen(false)
      router.refresh()
    } else {
      setError('Something went wrong. Please try again.')
    }
  }

  const confirmed = input.trim().toUpperCase() === 'YES'

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-xl px-4 py-2 text-[13px] font-semibold border transition-colors"
        style={{
          borderColor: '#FCA5A5',
          color: '#DC2626',
          backgroundColor: '#FEF2F2',
        }}
      >
        Clear Pipeline
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={closeModal}
        >
          <div
            className="rounded-2xl shadow-xl px-8 py-7 w-full max-w-sm mx-4"
            style={{ backgroundColor: 'var(--ui-card-bg)', border: '1px solid var(--ui-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ui-text-primary)' }}>
              Clear entire pipeline?
            </p>
            <p className="text-[13px] mb-5" style={{ color: 'var(--ui-text-secondary)' }}>
              All active applicants will be removed from the pipeline. They will remain on the applicants page and can be recovered by changing their status.
            </p>

            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
              Type <span className="font-bold" style={{ color: 'var(--ui-text-primary)' }}>YES</span> to confirm
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && confirmed) handleClear() }}
              placeholder="YES"
              autoFocus
              className="w-full rounded-xl border px-3.5 py-2.5 text-[13px] mb-4 focus:outline-none"
              style={{
                borderColor: confirmed ? '#16A34A' : 'var(--ui-border)',
                backgroundColor: 'var(--ui-card-bg)',
                color: 'var(--ui-text-primary)',
              }}
            />

            {error && (
              <p className="text-[12px] text-red-600 mb-3">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-[13px] font-medium border transition-colors disabled:opacity-50"
                style={{
                  borderColor: 'var(--ui-border)',
                  color: 'var(--ui-text-secondary)',
                  backgroundColor: 'var(--ui-card-bg)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={!confirmed || loading}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: '#DC2626' }}
              >
                {loading ? 'Clearing…' : 'Clear Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
