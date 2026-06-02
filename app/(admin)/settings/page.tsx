import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import SettingsClient from '@/components/admin/settings/SettingsClient'
import VapiAssistantConfig from '@/components/admin/settings/VapiAssistantConfig'
import { DEFAULT_VAPI_CONFIG, type VapiAssistantConfig as VapiConfig } from '@/lib/types/vapi'

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

  const managerLocation = profile?.role === 'location_manager'
    ? locationRows.find((l) => l.id === profile.location_id) ?? null
    : null

  const calendarConnected = !!(profile as { calendar_token_encrypted?: string | null } | null)
    ?.calendar_token_encrypted

  // Load company Vapi config
  let vapiConfig: VapiConfig = DEFAULT_VAPI_CONFIG
  let vapiAssistantId: string | null = null

  const companyId = (profile as { company_id?: string } | null)?.company_id
  if (companyId) {
    const { data: company } = await adminDb
      .from('companies')
      .select('name, settings')
      .eq('id', companyId)
      .single()

    if (company) {
      const stored = (company.settings as Record<string, unknown>)?.vapi as Record<string, unknown> | undefined
      if (stored) {
        vapiAssistantId = (stored.assistantId as string) ?? null
        vapiConfig = {
          assistantPersonaName: (stored.assistantPersonaName as string) ?? DEFAULT_VAPI_CONFIG.assistantPersonaName,
          companyName: (stored.companyName as string) ?? company.name,
          jobTitle: (stored.jobTitle as string) ?? DEFAULT_VAPI_CONFIG.jobTitle,
          voiceId: (stored.voiceId as string) ?? DEFAULT_VAPI_CONFIG.voiceId,
          openingLine: (stored.openingLine as string) ?? DEFAULT_VAPI_CONFIG.openingLine,
          closingLine: (stored.closingLine as string) ?? DEFAULT_VAPI_CONFIG.closingLine,
          payAndScheduleResponse: (stored.payAndScheduleResponse as string) ?? DEFAULT_VAPI_CONFIG.payAndScheduleResponse,
          maxCallDurationMinutes: (stored.maxCallDurationMinutes as number) ?? DEFAULT_VAPI_CONFIG.maxCallDurationMinutes,
          tone: (stored.tone as VapiConfig['tone']) ?? DEFAULT_VAPI_CONFIG.tone,
        }
      } else {
        // Pre-fill company name from the companies table
        vapiConfig = { ...DEFAULT_VAPI_CONFIG, companyName: company.name }
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl">
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

      {/* Vapi AI Assistant */}
      <section className="mb-6 bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
          AI Screening Assistant
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          Configure the AI that calls applicants for phone screening. Changes go live when you click Deploy.
        </p>
        <VapiAssistantConfig initialConfig={vapiConfig} assistantId={vapiAssistantId} />
      </section>

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
