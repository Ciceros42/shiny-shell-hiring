import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCompanyPipelineMode } from '@/lib/db/companies'
import ApplicantsTree, { type AppListItem } from '@/components/admin/applicants/ApplicantsTree'

export const revalidate = 0

export default async function ApplicantsPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  const pipelineMode = await getCompanyPipelineMode(companyId)

  // Fetch applications with related data via adminDb (bypasses RLS for joins)
  let query = adminDb
    .from('applications')
    .select(`
      id, status, created_at,
      applicants(id, name, phone),
      locations(id, name),
      jobs(id, title),
      screen_results(passed, total_score)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500)

  query = query.eq('company_id', companyId)
  if (role === 'location_manager' && locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: rows, count } = await query

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
        {count !== null && count > apps.length ? (
          <p className="mt-0.5 text-sm text-amber-600">
            Showing {apps.length} of {count} applicants — use filters to narrow results
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-gray-500">{apps.length} applicants</p>
        )}
      </div>
      <div className="flex-1 overflow-auto px-8 py-4">
        <ApplicantsTree apps={apps} pipelineMode={pipelineMode} />
      </div>
    </div>
  )
}
