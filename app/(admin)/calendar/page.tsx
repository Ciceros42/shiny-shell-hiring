import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CalendarManager from '@/components/admin/calendar/CalendarManager'

export const revalidate = 0

export default async function CalendarPage() {
  const { user, profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  const { data: calProfile } = await adminDb
    .from('profiles')
    .select('calendar_token_encrypted, calendar_email')
    .eq('id', user.id)
    .single()

  const calendarConnected = !!calProfile?.calendar_token_encrypted
  const calendarEmail = (calProfile?.calendar_email as string | null) ?? null

  // Company admin: fetch all locations so they can choose
  const { data: locations } = await adminDb
    .from('locations')
    .select('id, name, timezone')
    .eq('company_id', companyId)
    .order('name')

  const locationOptions = (locations ?? []) as { id: string; name: string; timezone: string }[]

  // Default to manager's own location or first available
  const defaultLocationId =
    locationId ?? locationOptions[0]?.id ?? null

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

  // interview_slots has no company_id column; defaultLocationId is already
  // derived from company-scoped locations, so location scoping is sufficient.
  const { data: slots } = await adminDb
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
        locationOptions={role === 'company_admin' ? locationOptions : []}
        initialSlots={slotRows}
        timezone={defaultTimezone}
        hasShortage={hasShortage}
        availableNext7={availableNext7}
        managerId={user.id}
        calendarConnected={calendarConnected}
        calendarEmail={calendarEmail}
      />
    </div>
  )
}
