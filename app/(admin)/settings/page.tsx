import { createClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/admin/settings/SettingsClient'
import VapiSyncButton from '@/components/admin/settings/VapiSyncButton'

export const revalidate = 0

type SearchParams = { calendar_connected?: string; calendar_error?: string }

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { calendar_connected, calendar_error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, company_id, location_id, phone, calendar_token_encrypted')
    .eq('id', user.id)
    .single()

  // Load locations accessible to this user
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, slug, timezone, is_hiring')
    .order('name')

  type LocationRow = {
    id: string
    name: string
    slug: string
    timezone: string
    is_hiring: boolean
  }

  const locationRows = (locations ?? []) as LocationRow[]

  // For location managers, only their own location
  const managerLocation = profile?.role === 'location_manager'
    ? locationRows.find((l) => l.id === profile.location_id) ?? null
    : null

  const calendarConnected = !!(profile as { calendar_token_encrypted?: string | null } | null)
    ?.calendar_token_encrypted

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {calendar_connected === '1' && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          Google Calendar connected successfully.
        </div>
      )}
      {calendar_error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          Calendar error: {calendar_error}
        </div>
      )}

      {/* Vapi Assistant */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Vapi AI Assistant
        </h2>
        <VapiSyncButton hasAssistantId={!!process.env.VAPI_ASSISTANT_ID} />
      </div>

      <SettingsClient
        userId={user.id}
        userName={(profile as { name: string } | null)?.name ?? ''}
        userEmail={user.email ?? ''}
        calendarConnected={calendarConnected}
        locations={locationRows}
        managerLocation={managerLocation}
        role={(profile as { role: string } | null)?.role ?? 'location_manager'}
      />
    </div>
  )
}
