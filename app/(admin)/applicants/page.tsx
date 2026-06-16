import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ApplicantsDirectory from '@/components/admin/applicants/ApplicantsDirectory'

export const revalidate = 0

export default async function ApplicantsPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  let query = adminDb
    .from('applicants')
    .select(`
      id, name, phone, email, created_at,
      applications(id, status, created_at, company_id, location_id, jobs(title), locations(name))
    `)
    .order('name', { ascending: true })

  // Filter to applicants who have applied to this company
  const { data: rows } = await query

  type AppRow = {
    id: string
    status: string
    created_at: string
    company_id: string
    location_id: string | null
    jobs: { title: string } | null
    locations: { name: string } | null
  }

  type RawRow = {
    id: string
    name: string
    phone: string
    email: string | null
    created_at: string
    applications: AppRow[] | AppRow | null
  }

  // Filter to applicants with at least one application in this company/location
  const all = ((rows ?? []) as unknown as RawRow[])
    .map((r) => {
      const apps = (Array.isArray(r.applications) ? r.applications : r.applications ? [r.applications] : []) as AppRow[]
      const companyApps = apps.filter((a) => {
        if (a.company_id !== companyId) return false
        if (role === 'location_manager' && locationId && a.location_id !== locationId) return false
        return true
      })
      return { ...r, applications: companyApps }
    })
    .filter((r) => r.applications.length > 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-8 py-6 border-b border-gray-200 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Applicants</h1>
        <p className="mt-0.5 text-sm text-gray-500">{all.length} people on file</p>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">
        <ApplicantsDirectory applicants={all} />
      </div>
    </div>
  )
}
