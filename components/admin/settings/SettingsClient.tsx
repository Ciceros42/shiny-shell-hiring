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
}

export default function SettingsClient({
  userName,
  userEmail,
  calendarConnected,
  locations,
  managerLocation,
  role,
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
