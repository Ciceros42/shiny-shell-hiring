'use client'

import { useState, useEffect } from 'react'

type IQItem = { id: string; text: string; hint: string | null; order_index: number }

export default function InterviewQuestionsSettings() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<IQItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newText, setNewText] = useState('')
  const [newHint, setNewHint] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/admin/interview-questions')
      .then(r => r.json())
      .then(setItems)
      .finally(() => setLoading(false))
  }, [open])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const res = await fetch('/api/admin/interview-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText.trim(), hint: newHint.trim() || null }),
    })
    if (res.ok) {
      const item = await res.json()
      setItems(prev => [...prev, item])
      setNewText('')
      setNewHint('')
      setShowHint(false)
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/admin/interview-questions/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-900">Interview Questions</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length > 0 ? `${items.length} question${items.length !== 1 ? 's' : ''} — shown in the live interview guide` : 'Questions shown in the popup guide during interviews'}
          </p>
        </div>
        <svg className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {loading && <p className="text-xs text-gray-400">Loading…</p>}

          {!loading && items.length === 0 && (
            <p className="text-xs text-gray-400">No questions yet. Add some to use during the live interview guide popup.</p>
          )}

          <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-3 px-3 py-3 bg-white">
                <span className="text-xs font-mono text-gray-300 mt-0.5 shrink-0 w-4">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{item.text}</p>
                  {item.hint && <p className="text-xs text-gray-400 italic mt-0.5">{item.hint}</p>}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40 mt-0.5"
                >
                  {deletingId === item.id ? '…' : '✕'}
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAdd} className="space-y-2">
            <input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="e.g. Tell me about a time you handled a difficult customer."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
            {showHint ? (
              <input
                value={newHint}
                onChange={e => setNewHint(e.target.value)}
                placeholder="Hint for the interviewer (optional)"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            ) : (
              <button type="button" onClick={() => setShowHint(true)} className="text-xs text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline">
                + Add a hint
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding || !newText.trim()}
                className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {adding ? '…' : 'Add question'}
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-400">
            These appear in the Interview Guide popup alongside the applicant's phone screen summary.
          </p>
        </div>
      )}
    </div>
  )
}
