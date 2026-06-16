'use client'

import { useState, useEffect } from 'react'

type TemplateItem = { id: string; text: string; order_index: number }

export default function OnboardingChecklistSettings() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/admin/onboarding/templates')
      .then(r => r.json())
      .then(setItems)
      .finally(() => setLoading(false))
  }, [open])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const res = await fetch('/api/admin/onboarding/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText.trim() }),
    })
    if (res.ok) {
      const item = await res.json()
      setItems(prev => [...prev, item])
      setNewText('')
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/admin/onboarding/templates/${id}`, { method: 'DELETE' })
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
          <p className="text-sm font-semibold text-gray-900">Onboarding Checklist</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''} — generated for every new hire` : 'Tasks generated for every new hire'}
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
            <p className="text-xs text-gray-400">No checklist items yet. Add tasks below — they'll be created for every new hire.</p>
          )}

          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-3 py-2.5 bg-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-gray-300 text-sm shrink-0">☐</span>
                  <span className="text-sm text-gray-800 truncate">{item.text}</span>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors ml-3 shrink-0 disabled:opacity-40"
                >
                  {deletingId === item.id ? '…' : '✕'}
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="e.g. Offer letter signed"
              className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={adding || !newText.trim()}
              className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {adding ? '…' : 'Add'}
            </button>
          </form>
          <p className="text-xs text-gray-400">These items are copied to the applicant when you click Hire.</p>
        </div>
      )}
    </div>
  )
}
