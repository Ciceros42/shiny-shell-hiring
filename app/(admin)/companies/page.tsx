'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Company = { id: string; name: string; displayName: string; primaryColor: string; createdAt: string }

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [brandColor, setBrandColor] = useState('#1e3c6c')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/companies').then((r) => r.json()).then(setCompanies).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !displayName.trim()) { setError('Name and display name are required'); return }
    setSaving(true)
    const res = await fetch('/api/admin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), displayName: displayName.trim(), brandColor }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to create'); return }
    setShowForm(false); setName(''); setDisplayName(''); setBrandColor('#1e3c6c')
    router.refresh()
    fetch('/api/admin/companies').then((r) => r.json()).then(setCompanies)
  }

  const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none'

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">All companies using the hiring platform.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors" style={{ backgroundColor: '#1e3c6c' }}>
          {showForm ? 'Cancel' : '+ New company'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-blue-300 p-5 mb-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">New company</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Internal name * <span className="text-gray-400">(e.g. "shiny-shell")</span></label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="shiny-shell" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Display name * <span className="text-gray-400">(shown in the portal)</span></label>
            <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shiny Shell Carwash" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Brand color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
              <input className={inputClass + ' flex-1'} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#1e3c6c" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create company'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No companies yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.primaryColor }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{c.displayName}</p>
                  <p className="text-xs text-gray-400">{c.name} · Created {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
