'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type LocationRow = {
  id: string
  name: string
  slug: string
  timezone: string
  is_hiring: boolean
}

type Props = {
  userId: string
  userName: string
  userEmail: string
  calendarConnected: boolean
  locations: LocationRow[]
  managerLocation: LocationRow | null
  role: string
  pipelineMode: 'suggestion' | 'assistant'
  fontUrl: string | null
  fontFamily: string | null
}

export default function SettingsClient({
  userName,
  userEmail,
  calendarConnected,
  locations,
  managerLocation,
  role,
  pipelineMode: initialPipelineMode,
  fontUrl: initialFontUrl,
  fontFamily: initialFontFamily,
}: Props) {
  const router = useRouter()

  // For location managers: single toggle. For admins: list of toggles.
  const editableLocations = role === 'location_manager' && managerLocation
    ? [managerLocation]
    : locations

  const [hiringStates, setHiringStates] = useState<Record<string, boolean>>(
    Object.fromEntries(editableLocations.map((l) => [l.id, l.is_hiring]))
  )
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [calConnected, setCalConnected] = useState(calendarConnected)
  const [error, setError] = useState<string | null>(null)
  const [pipelineMode, setPipelineMode] = useState<'suggestion' | 'assistant'>(initialPipelineMode)
  const [savingMode, setSavingMode] = useState(false)
  const [fontUrl, setFontUrl] = useState(initialFontUrl ?? '')
  const [savingFont, setSavingFont] = useState(false)
  const [fontSaved, setFontSaved] = useState(false)

  async function toggleHiring(locationId: string) {
    const newValue = !hiringStates[locationId]
    setTogglingId(locationId)
    setError(null)

    const res = await fetch(`/api/admin/locations/${locationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hiring: newValue }),
    })

    setTogglingId(null)
    if (!res.ok) { setError('Failed to update location'); return }
    setHiringStates((s) => ({ ...s, [locationId]: newValue }))
    router.refresh()
  }

  async function saveFont() {
    setSavingFont(true)
    setFontSaved(false)
    const res = await fetch('/api/admin/settings/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fontUrl: fontUrl.trim() || null }),
    })
    setSavingFont(false)
    if (res.ok) { setFontSaved(true); router.refresh() }
    else setError('Failed to save font')
  }

  async function savePipelineMode(mode: 'suggestion' | 'assistant') {
    setSavingMode(true)
    setError(null)
    const res = await fetch('/api/admin/settings/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    setSavingMode(false)
    if (!res.ok) { setError('Failed to save pipeline mode'); return }
    setPipelineMode(mode)
  }

  async function disconnectCalendar() {
    if (!confirm('Disconnect Google Calendar? Interview events will no longer be created automatically.')) return
    setDisconnecting(true)
    const res = await fetch('/api/admin/calendar/disconnect', { method: 'POST' })
    setDisconnecting(false)
    if (!res.ok) { setError('Failed to disconnect calendar'); return }
    setCalConnected(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Pipeline Mode */}
      {role === 'company_admin' && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Pipeline Mode</h2>
          <p className="text-xs text-gray-400 mb-4">Controls what happens automatically after a screen call completes.</p>
          <div className="space-y-3">
            {(['suggestion', 'assistant'] as const).map((mode) => {
              const active = pipelineMode === mode
              return (
                <label
                  key={mode}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="pipeline_mode"
                    value={mode}
                    checked={active}
                    onChange={() => savePipelineMode(mode)}
                    disabled={savingMode}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{mode} Mode</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {mode === 'suggestion'
                        ? 'AI scores and recommends Pass/Fail. You review and manually advance or reject from the Applicants page.'
                        : 'AI automatically fails applicants below the threshold and sends a scheduling SMS link to those who pass.'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
          {savingMode && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
        </section>
      )}

      {/* Profile */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Profile</h2>
        <div className="space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="w-16 text-gray-400 shrink-0">Name</span>
            <span className="text-gray-900">{userName || '—'}</span>
          </div>
          <div className="flex gap-3">
            <span className="w-16 text-gray-400 shrink-0">Email</span>
            <span className="text-gray-900">{userEmail}</span>
          </div>
          <div className="flex gap-3">
            <span className="w-16 text-gray-400 shrink-0">Role</span>
            <span className="text-gray-600 capitalize">{role.replace('_', ' ')}</span>
          </div>
        </div>
      </section>

      {/* Location hiring toggles */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Locations
        </h2>
        {editableLocations.length === 0 ? (
          <p className="text-sm text-gray-400">No locations found.</p>
        ) : (
          <div className="space-y-3">
            {editableLocations.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                  <p className="text-xs text-gray-400">{loc.timezone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${hiringStates[loc.id] ? 'text-green-600' : 'text-gray-400'}`}>
                    {hiringStates[loc.id] ? 'Hiring' : 'Not hiring'}
                  </span>
                  <button
                    role="switch"
                    aria-checked={hiringStates[loc.id]}
                    onClick={() => toggleHiring(loc.id)}
                    disabled={togglingId === loc.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 ${
                      hiringStates[loc.id] ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        hiringStates[loc.id] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          When not hiring, the apply form at /apply/{editableLocations[0]?.slug ?? '…'} will show a "not currently hiring" message.
        </p>
      </section>

      {/* Brand Font */}
      {role === 'company_admin' && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Brand Font</h2>
          <p className="text-xs text-gray-400 mb-4">
            Paste a Google Fonts embed URL (e.g. <span className="font-mono">https://fonts.googleapis.com/css2?family=Poppins:wght@400;600</span>). Applied to the applicant-facing apply and scheduling pages only.
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <input
                value={fontUrl}
                onChange={(e) => { setFontUrl(e.target.value); setFontSaved(false) }}
                placeholder="https://fonts.googleapis.com/css2?family=…"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
            <button
              onClick={saveFont}
              disabled={savingFont}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {savingFont ? 'Saving…' : 'Save'}
            </button>
          </div>
          {fontSaved && <p className="mt-2 text-xs text-green-600">Font saved. Takes effect on the apply page immediately.</p>}
          {fontUrl && (
            <p className="mt-2 text-xs text-gray-400">
              Current:{' '}
              <span className="font-mono">{fontUrl.length > 60 ? fontUrl.slice(0, 60) + '…' : fontUrl}</span>
              {' '}
              <button onClick={() => { setFontUrl(''); saveFont() }} className="text-red-400 hover:text-red-600 ml-1">Remove</button>
            </p>
          )}
        </section>
      )}

      {/* Google Calendar */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Google Calendar
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {calConnected ? 'Connected' : 'Not connected'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {calConnected
                ? 'Interview slots are automatically added to your calendar.'
                : 'Connect to automatically create calendar events when interviews are booked.'}
            </p>
          </div>
          {calConnected ? (
            <button
              onClick={disconnectCalendar}
              disabled={disconnecting}
              className="text-sm text-red-500 hover:underline disabled:opacity-40"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <a
              href="/api/admin/calendar/connect"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Connect Google Calendar
            </a>
          )}
        </div>
      </section>
    </div>
  )
}
