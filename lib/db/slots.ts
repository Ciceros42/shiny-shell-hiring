import { adminDb } from '@/lib/supabase/admin'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Fix 14: hour-bucket function replaces string-key lookup that never matched PG time values
function shiftPeriod(t: string): string {
  const h = parseInt(t.split(':')[0], 10)
  if (h >= 5 && h < 12) return 'mornings'
  if (h >= 12 && h < 17) return 'afternoons'
  return 'evenings'
}

export async function getUrgentShiftLabel(locationId: string): Promise<string | undefined> {
  const { data } = await adminDb
    .from('shifts')
    .select('day_of_week, start_time, label')
    .eq('location_id', locationId)
    .eq('is_critical', true)
    .limit(1)
    .maybeSingle()

  if (!data) return undefined
  return (data.label as string | null) ?? `${DAY_NAMES[data.day_of_week as number]} ${shiftPeriod(data.start_time as string)}`
}

export async function getAvailableSlots(locationId: string, afterTime: Date) {
  const { data } = await adminDb
    .from('interview_slots')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_available', true)
    .gte('start_time', afterTime.toISOString())
    .order('start_time', { ascending: true })

  return data ?? []
}
