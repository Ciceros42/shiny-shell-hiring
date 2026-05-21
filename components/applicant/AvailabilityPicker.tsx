'use client'

const DAYS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
] as const

const SHIFTS = [
  { id: 'morning', label: 'Mornings (5am–12pm)' },
  { id: 'afternoon', label: 'Afternoons (12pm–5pm)' },
  { id: 'evening', label: 'Evenings (5pm–close)' },
] as const

interface AvailabilityValue {
  days: string[]
  shifts: string[]
}

interface Props {
  value: AvailabilityValue
  onChange: (v: AvailabilityValue) => void
  error?: string
}

export function AvailabilityPicker({ value, onChange, error }: Props) {
  function toggleDay(id: string) {
    const days = value.days.includes(id)
      ? value.days.filter((d) => d !== id)
      : [...value.days, id]
    onChange({ ...value, days })
  }

  function toggleShift(id: string) {
    const shifts = value.shifts.includes(id)
      ? value.shifts.filter((s) => s !== id)
      : [...value.shifts, id]
    onChange({ ...value, shifts })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Available days *</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => toggleDay(day.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                value.days.includes(day.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Available shifts *</p>
        <div className="space-y-2">
          {SHIFTS.map((shift) => (
            <label key={shift.id} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={value.shifts.includes(shift.id)}
                onChange={() => toggleShift(shift.id)}
                className="h-5 w-5 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700">{shift.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
