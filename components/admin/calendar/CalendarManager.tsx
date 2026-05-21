'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

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
}: Props) {
  const router = useRouter()
  const [slots, setSlots] = useState<SlotRow[]>(initialSlots)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Today's date in local format for min constraint
  const todayStr = new Date().toISOString().split('T')[0]

  // Group slots by date (in the location's timezone)
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

    // Build ISO datetimes from local date + time using a wall-clock approach
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
    setSlots((s) => [...s, newSlot].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    ))
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
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
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
                        <span className="text-sm text-gray-900 font-medium">
                          {start} – {end}
                        </span>
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
