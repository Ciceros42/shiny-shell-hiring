'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type SlotRow = {
  id: string
  start_time: string
  end_time: string
  is_available: boolean
  manager_user_id: string
}

type Props = {
  locationId: string
  locationOptions: { id: string; name: string; timezone: string }[]
  initialSlots: SlotRow[]
  timezone: string
  hasShortage: boolean
  availableNext7: number
  managerId: string
  calendarConnected: boolean
  calendarEmail: string | null
}

const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
]

export default function CalendarManager({
  locationId,
  initialSlots,
  timezone,
  hasShortage,
  availableNext7,
  calendarConnected,
  calendarEmail,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [slots, setSlots] = useState<SlotRow[]>(initialSlots)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [justConnected, setJustConnected] = useState(false)

  // Show success flash when redirected back after OAuth
  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setJustConnected(true)
      const t = setTimeout(() => setJustConnected(false), 4000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  const todayStr = new Date().toISOString().split('T')[0]

  const grouped = useMemo(() => {
    const map = new Map<string, SlotRow[]>()
    for (const slot of slots) {
      const dateKey = new Date(slot.start_time).toLocaleDateString('en-CA', { timeZone: timezone })
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(slot)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [slots, timezone])

  async function addSlot() {
    if (!date || !time) { setError('Date and time are required'); return }
    setError(null)
    setSaving(true)

    const startLocal = new Date(`${date}T${time}:00`)
    const endLocal = new Date(startLocal.getTime() + duration * 60 * 1000)

    const res = await fetch('/api/admin/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: locationId,
        start_time: startLocal.toISOString(),
        end_time: endLocal.toISOString(),
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to add slot')
      return
    }

    const newSlot = await res.json()
    setSlots((s) => [...s, newSlot].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    setShowForm(false)
    setDate('')
    router.refresh()
  }

  async function deleteSlot(slotId: string) {
    setDeletingId(slotId)
    const res = await fetch(`/api/admin/slots/${slotId}`, { method: 'DELETE' })
    setDeletingId(null)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to remove slot')
      return
    }

    setSlots((s) => s.filter((slot) => slot.id !== slotId))
    router.refresh()
  }

  async function disconnect() {
    setDisconnecting(true)
    await fetch('/api/admin/calendar/disconnect', { method: 'POST' })
    router.refresh()
  }

  function formatSlotTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
    })
  }

  function formatDayHeader(dateKey: string) {
    return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })
  }

  const availableCount = slots.filter((s) => s.is_available).length

  return (
    <div>
      {/* Google Calendar connection status */}
      {justConnected && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-green-500 text-lg">✓</span>
          <p className="text-sm font-medium text-green-800">
            Google Calendar connected{calendarEmail ? ` as ${calendarEmail}` : ''}. Interview bookings will now create calendar events automatically.
          </p>
        </div>
      )}

      {!calendarConnected && !justConnected && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Connect Google Calendar</p>
            <p className="text-sm text-gray-500 mt-0.5">
              When a candidate books an interview, it will automatically appear on your calendar.
            </p>
          </div>
          <a
            href="/api/admin/calendar/connect"
            className="flex items-center gap-2.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </a>
        </div>
      )}

      {calendarConnected && !justConnected && (
        <div className="mb-5 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-sm">✓</span>
            <p className="text-sm text-green-800">
              Google Calendar connected{calendarEmail ? <> as <span className="font-medium">{calendarEmail}</span></> : ''}
            </p>
          </div>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      )}

      {/* Shortage warning */}
      {hasShortage && (
        <div className="mb-5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Slot shortage — only {availableNext7} available slot{availableNext7 !== 1 ? 's' : ''} in the next 7 days
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Candidates who pass screening won't be able to book. Add more slots below.
            </p>
          </div>
        </div>
      )}

      {/* Stats + Add button */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          {availableCount} available slot{availableCount !== 1 ? 's' : ''} in the next 28 days
        </p>
        <button
          onClick={() => { setShowForm((v) => !v); setError(null) }}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Slot'}
        </button>
      </div>

      {/* Add slot form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-blue-300 p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Interview Slot</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DURATIONS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>{d.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={addSlot}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-gray-400">
            Times are in your browser's local timezone. Candidates see slots converted to their own timezone.
          </p>
        </div>
      )}

      {!showForm && error && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Slot list grouped by day */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No slots in the next 28 days.</p>
          <p className="text-xs text-gray-400 mt-1">Use the button above to add your first slot.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, daySlots]) => (
            <div key={dateKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {formatDayHeader(dateKey)}
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {daySlots.map((slot) => {
                  const start = formatSlotTime(slot.start_time)
                  const end = formatSlotTime(slot.end_time)
                  const booked = !slot.is_available
                  return (
                    <li
                      key={slot.id}
                      className={`flex items-center justify-between px-4 py-2.5 ${booked ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-900 font-medium">{start} – {end}</span>
                        {booked && (
                          <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
                            booked
                          </span>
                        )}
                      </div>
                      {!booked && (
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          disabled={deletingId === slot.id}
                          className="text-xs text-red-500 hover:underline disabled:opacity-40"
                        >
                          {deletingId === slot.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
