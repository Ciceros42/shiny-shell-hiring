import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import { getCompanyPipelineMode } from '@/lib/db/companies'
import ApplicantsTree, { type AppListItem } from '@/components/admin/applicants/ApplicantsTree'

export const revalidate = 0

export default async function ApplicantsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, location_id')
    .eq('id', user.id)
    .single()

  const companyId = (profile as { company_id?: string } | null)?.company_id
  const pipelineMode = companyId ? await getCompanyPipelineMode(companyId) : 'suggestion'

  // Fetch applications with related data via adminDb (bypasses RLS for joins)
  let query = adminDb
    .from('applications')
    .select(`
      id, status, created_at,
      applicants(id, name, phone),
      locations(id, name),
      jobs(id, title),
      screen_results(passed, total_score)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (profile?.role === 'location_manager' && profile.location_id) {
    query = query.eq('location_id', profile.location_id)
  } else if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: rows } = await query

  type RawRow = {
    id: string
    status: string
    created_at: string
    applicants: { id: string; name: string; phone: string } | null
    locations: { id: string; name: string } | null
    jobs: { id: string; title: string } | null
    screen_results: Array<{ passed: boolean; total_score: number | null }> | { passed: boolean; total_score: number | null } | null
  }

  const apps: AppListItem[] = ((rows ?? []) as unknown as RawRow[]).map((r) => {
    const sr = Array.isArray(r.screen_results)
      ? r.screen_results[0]
      : (r.screen_results ?? null)
    return {
      id: r.id,
      applicantId: r.applicants?.id ?? '',
      applicantName: r.applicants?.name ?? '—',
      applicantPhone: r.applicants?.phone ?? '',
      jobTitle: r.jobs?.title ?? null,
      locationName: r.locations?.name ?? '—',
      status: r.status,
      createdAt: r.created_at,
      score: sr?.total_score ?? null,
      aiPassed: sr?.passed ?? null,
    }
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-8 py-6 border-b border-gray-200 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Applicants</h1>
        <p className="mt-0.5 text-sm text-gray-500">{apps.length} total</p>
      </div>
      <div className="flex-1 overflow-auto px-8 py-4">
        <ApplicantsTree apps={apps} pipelineMode={pipelineMode} />
      </div>
    </div>
  )
}
