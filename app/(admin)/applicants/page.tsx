import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ApplicantFilters from '@/components/admin/applicants/ApplicantFilters'

export const revalidate = 0

const STATUS_COLORS: Record<string, string> = {
  applied:             'bg-gray-100 text-gray-700',
  sms_sent:            'bg-blue-50 text-blue-700',
  screen_link_clicked: 'bg-indigo-50 text-indigo-700',
  screening:           'bg-yellow-50 text-yellow-700',
  screen_complete:     'bg-orange-50 text-orange-700',
  passed:              'bg-green-50 text-green-700',
  failed:              'bg-red-50 text-red-700',
  scheduled:           'bg-teal-50 text-teal-700',
  interviewed:         'bg-purple-50 text-purple-700',
  hired:               'bg-emerald-50 text-emerald-700',
  no_show:             'bg-rose-50 text-rose-700',
  rejected:            'bg-slate-100 text-slate-600',
}

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied', sms_sent: 'SMS Sent', screen_link_clicked: 'Link Opened',
  screening: 'On Call', screen_complete: 'Screen Done', passed: 'Passed',
  failed: 'Failed', scheduled: 'Interview Set', interviewed: 'Interviewed',
  hired: 'Hired', no_show: 'No Show', rejected: 'Rejected',
}

type SearchParams = { status?: string; search?: string; location?: string }

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { status, search, location } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, location_id')
    .eq('id', user.id)
    .single()

  // Fetch locations for the filter dropdown
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .order('name')
  const locationOptions = (locations ?? []) as { id: string; name: string }[]

  // Build applications query — RLS scopes data automatically
  let query = supabase
    .from('applications')
    .select('id, status, created_at, applicant_id, applicants(id, name, phone), locations(id, name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (profile?.role === 'location_manager' && profile.location_id) {
    query = query.eq('location_id', profile.location_id)
  } else if (location) {
    query = query.eq('location_id', location)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: rows } = await query

  type AppRow = {
    id: string
    status: string
    created_at: string
    applicant_id: string
    applicants: { id: string; name: string; phone: string } | null
    locations: { id: string; name: string } | null
  }

  let apps = (rows ?? []) as unknown as AppRow[]

  // Client-side name search (PostgREST can't filter on joined columns)
  if (search) {
    const q = search.toLowerCase()
    apps = apps.filter(
      (a) => a.applicants?.name.toLowerCase().includes(q) || a.applicants?.phone.includes(q)
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applicants</h1>
          <p className="mt-0.5 text-sm text-gray-500">{apps.length} results</p>
        </div>
        <ApplicantFilters locationOptions={profile?.role === 'company_admin' ? locationOptions : []} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {apps.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">No applicants found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Phone</th>
                {profile?.role === 'company_admin' && (
                  <th className="px-4 py-3 text-left hidden md:table-cell">Location</th>
                )}
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/applicants/${app.applicant_id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {app.applicants?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {app.applicants?.phone ?? '—'}
                  </td>
                  {profile?.role === 'company_admin' && (
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {app.locations?.name ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[app.status] ?? app.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
