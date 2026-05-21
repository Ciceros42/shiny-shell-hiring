'use client'

import type { SlotDisplay } from '@/lib/scheduling/slots'

interface Props {
  slots: SlotDisplay[]
  selectedId: string | null
  onSelect: (id: string) => void
  disabled?: boolean
}

export function SlotPicker({ slots, selectedId, onSelect, disabled }: Props) {
  // Group by date label
  const groups = slots.reduce<Record<string, SlotDisplay[]>>((acc, slot) => {
    if (!acc[slot.dateLabel]) acc[slot.dateLabel] = []
    acc[slot.dateLabel].push(slot)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([date, daySlots]) => (
        <div key={date}>
          <p className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">{date}</p>
          <div className="grid grid-cols-2 gap-2">
            {daySlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(slot.id)}
                className={`rounded-lg border-2 py-3 px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                  selectedId === slot.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                {slot.timeLabel}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
