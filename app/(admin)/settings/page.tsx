import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/admin/settings/SettingsClient'
import VapiAssistantConfig from '@/components/admin/settings/VapiAssistantConfig'
import OnboardingChecklistSettings from '@/components/admin/settings/OnboardingChecklistSettings'
import InterviewQuestionsSettings from '@/components/admin/settings/InterviewQuestionsSettings'
import { DEFAULT_VAPI_CONFIG, type VapiAssistantConfig as VapiConfig } from '@/lib/types/vapi'
import { getCompanyConfig } from '@/lib/db/companies'

export const revalidate = 0

type SearchParams = { calendar_connected?: string; calendar_error?: string }

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { calendar_connected, calendar_error } = await searchParams

  const { user, profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  const { data: userProfile } = await adminDb
    .from('profiles')
    .select('name, calendar_token_encrypted')
    .eq('id', user.id)
    .single()

  // Auth email is not stored in the profiles table; read it from the auth session.
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const userEmail = authUser?.email ?? ''

  type LocationRow = {
    id: string
    name: string
    slug: string
    timezone: string
    is_hiring: boolean
  }

  // Run locations fetch and company config lookup in parallel
  const locationsQuery = adminDb
    .from('locations')
    .select('id, name, slug, timezone, is_hiring')
    .eq('company_id', companyId)
    .order('name')

  const [{ data: locations }, config] = await Promise.all([
    locationsQuery,
    getCompanyConfig(companyId),
  ])

  const locationRows = (locations ?? []) as LocationRow[]

  const managerLocation = role === 'location_manager'
    ? locationRows.find((l) => l.id === locationId) ?? null
    : null

  const calendarConnected = !!(userProfile as { calendar_token_encrypted?: string | null } | null)
    ?.calendar_token_encrypted

  // Derive Vapi config + pipeline mode from the single company config fetch
  let vapiConfig: VapiConfig = DEFAULT_VAPI_CONFIG
  let vapiAssistantId: string | null = null
  let pipelineMode: 'suggestion' | 'assistant' = 'suggestion'

  if (config) {
    pipelineMode = config.pipelineMode

    const stored = config.settings.vapi as Record<string, unknown> | undefined
    if (stored) {
      vapiAssistantId = (stored.assistantId as string) ?? null
      vapiConfig = {
        assistantPersonaName: (stored.assistantPersonaName as string) ?? DEFAULT_VAPI_CONFIG.assistantPersonaName,
        companyName: (stored.companyName as string) ?? config.displayName,
        jobTitle: (stored.jobTitle as string) ?? DEFAULT_VAPI_CONFIG.jobTitle,
        voiceId: (stored.voiceId as string) ?? DEFAULT_VAPI_CONFIG.voiceId,
        openingLine: (stored.openingLine as string) ?? DEFAULT_VAPI_CONFIG.openingLine,
        closingLine: (stored.closingLine as string) ?? DEFAULT_VAPI_CONFIG.closingLine,
        payAndScheduleResponse: (stored.payAndScheduleResponse as string) ?? DEFAULT_VAPI_CONFIG.payAndScheduleResponse,
        maxCallDurationMinutes: (stored.maxCallDurationMinutes as number) ?? DEFAULT_VAPI_CONFIG.maxCallDurationMinutes,
        tone: (stored.tone as VapiConfig['tone']) ?? DEFAULT_VAPI_CONFIG.tone,
      }
    } else {
      // Pre-fill company name from config
      vapiConfig = { ...DEFAULT_VAPI_CONFIG, companyName: config.displayName }
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--ui-text-primary)' }}>
          Settings
        </h1>
      </div>

      {calendar_connected === '1' && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-green-500 text-base">✓</span>
          <p className="text-[13px] font-medium text-green-800">Google Calendar connected successfully.</p>
        </div>
      )}
      {calendar_error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-red-500 text-base">!</span>
          <p className="text-[13px] font-medium text-red-700">Calendar error: {calendar_error}</p>
        </div>
      )}

      {/* Vapi AI Assistant */}
      <div className="mb-5">
        <VapiAssistantConfig initialConfig={vapiConfig} assistantId={vapiAssistantId} />
      </div>

      {/* Interview Questions */}
      {role !== 'location_manager' && (
        <div className="mb-5">
          <InterviewQuestionsSettings />
        </div>
      )}

      {/* Onboarding Checklist */}
      {role !== 'location_manager' && (
        <div className="mb-5">
          <OnboardingChecklistSettings />
        </div>
      )}

      <SettingsClient
        userId={user.id}
        userName={(userProfile as { name: string } | null)?.name ?? ''}
        userEmail={userEmail}
        calendarConnected={calendarConnected}
        locations={locationRows}
        managerLocation={managerLocation}
        role={role}
        pipelineMode={pipelineMode}
        fontUrl={(config?.settings?.theme as Record<string, unknown> | undefined)?.fontUrl as string | null ?? null}
        fontFamily={(config?.settings?.theme as Record<string, unknown> | undefined)?.fontFamily as string | null ?? null}
      />
    </div>
  )
}
