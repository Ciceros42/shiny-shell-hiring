import { createClient } from '@/lib/supabase/server'
import CalendarManager from '@/components/admin/calendar/CalendarManager'

export const revalidate = 0

export default async function CalendarPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, location_id')
    .eq('id', user.id)
    .single()

  // Company admin: fetch all locations so they can choose
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, timezone')
    .order('name')

  const locationOptions = (locations ?? []) as { id: string; name: string; timezone: string }[]

  // Default to manager's own location or first available
  const defaultLocationId =
    profile?.location_id ?? locationOptions[0]?.id ?? null

  if (!defaultLocationId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Calendar</h1>
        <p className="text-sm text-gray-500">No location assigned to your profile.</p>
      </div>
    )
  }

  // Fetch slots for next 28 days
  const now = new Date().toISOString()
  const end = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString()

  const { data: slots } = await supabase
    .from('interview_slots')
    .select('id, start_time, end_time, is_available, manager_user_id')
    .eq('location_id', defaultLocationId)
    .gte('start_time', now)
    .lte('start_time', end)
    .order('start_time', { ascending: true })

  type SlotRow = {
    id: string
    start_time: string
    end_time: string
    is_available: boolean
    manager_user_id: string
  }

  const slotRows = (slots ?? []) as SlotRow[]

  // Shortage: < 3 available in next 7 days
  const next7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const availableNext7 = slotRows.filter(
    (s) => s.is_available && s.start_time <= next7
  ).length
  const hasShortage = availableNext7 < 3

  const defaultTimezone =
    locationOptions.find((l) => l.id === defaultLocationId)?.timezone ?? 'America/Denver'

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Calendar</h1>

      <CalendarManager
        locationId={defaultLocationId}
        locationOptions={profile?.role === 'company_admin' ? locationOptions : []}
        initialSlots={slotRows}
        timezone={defaultTimezone}
        hasShortage={hasShortage}
        availableNext7={availableNext7}
        managerId={user.id}
      />
    </div>
  )
}
