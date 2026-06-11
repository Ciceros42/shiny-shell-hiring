'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type LocationRow = { id: string; companyId: string; name: string; slug: string; timezone: string; isHiring: boolean }

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]

export default function LocationsPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('America/Denver')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/company-locations').then((r) => r.json()).then(setLocations).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const res = await fetch('/api/admin/company-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), timezone }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to create'); return }
    setShowForm(false); setName(''); setTimezone('America/Denver')
    router.refresh()
    fetch('/api/admin/company-locations').then((r) => r.json()).then(setLocations)
  }

  const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none'

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Physical locations that applicants apply to.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors" style={{ backgroundColor: 'var(--brand-primary)' }}>
          {showForm ? 'Cancel' : '+ New location'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-blue-300 p-5 mb-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">New location</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Location name *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Street" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Timezone *</label>
            <select className={inputClass + ' bg-white'} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create location'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No locations yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {locations.map((loc) => (
              <li key={loc.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {loc.timezone} · <span className="font-mono">/apply/…/{loc.slug}/</span>
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${loc.isHiring ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {loc.isHiring ? 'Hiring' : 'Not hiring'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
