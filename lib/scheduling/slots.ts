export interface SlotDisplay {
  id: string
  startTime: string   // ISO string
  endTime: string
  label: string       // e.g. "Monday, June 2 · 10:00 AM"
  dateLabel: string   // e.g. "Monday, June 2"
  timeLabel: string   // e.g. "10:00 AM"
}

export function formatSlotsForDisplay(
  slots: Array<{ id: string; start_time: string; end_time: string }>,
  timezone: string
): SlotDisplay[] {
  return slots.map((slot) => {
    const start = new Date(slot.start_time)

    const dateLabel = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    }).format(start)

    const timeLabel = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(start)

    return {
      id: slot.id,
      startTime: slot.start_time,
      endTime: slot.end_time,
      label: `${dateLabel} · ${timeLabel}`,
      dateLabel,
      timeLabel,
    }
  })
}

export function formatInterviewDateTime(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date)
}
