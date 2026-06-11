import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { ApplicationStatus } from '@/lib/db/applications'

export const revalidate = 60

type StatusCount = Record<ApplicationStatus, number>

const PIPELINE_STAGES: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'applied',             label: 'Applied',          color: 'bg-gray-100 text-gray-700' },
  { status: 'sms_sent',            label: 'SMS Sent',         color: 'bg-blue-50 text-blue-700' },
  { status: 'screen_link_clicked', label: 'Link Opened',      color: 'bg-indigo-50 text-indigo-700' },
  { status: 'screening',           label: 'On Call',          color: 'bg-yellow-50 text-yellow-700' },
  { status: 'screen_complete',     label: 'Screen Done',      color: 'bg-orange-50 text-orange-700' },
  { status: 'passed',              label: 'Passed',           color: 'bg-green-50 text-green-700' },
  { status: 'failed',              label: 'Failed',           color: 'bg-red-50 text-red-700' },
  { status: 'scheduled',           label: 'Interview Set',    color: 'bg-teal-50 text-teal-700' },
  { status: 'interviewed',         label: 'Interviewed',      color: 'bg-purple-50 text-purple-700' },
  { status: 'hired',               label: 'Hired',            color: 'bg-emerald-50 text-emerald-700' },
  { status: 'no_show',             label: 'No Show',          color: 'bg-rose-50 text-rose-700' },
  { status: 'rejected',            label: 'Rejected',         color: 'bg-slate-50 text-slate-600' },
]

export default async function DashboardPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Pipeline counts — explicitly scoped to the active company
  let appQuery = adminDb
    .from('applications')
    .select('status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', since30d)

  if (role === 'location_manager' && locationId) {
    appQuery = appQuery.eq('location_id', locationId)
  }

  const { data: appRows } = await appQuery

  const counts: StatusCount = {} as StatusCount
  for (const row of appRows ?? []) {
    counts[row.status as ApplicationStatus] = (counts[row.status as ApplicationStatus] ?? 0) + 1
  }

  const totalActive = (appRows ?? []).filter(
    (r) => !['failed', 'rejected', 'hired'].includes(r.status)
  ).length

  // SLA stats — needs a location_id; skip for company admins without a location
  type SlaStats = { median_minutes: number | null; pct_under_10_min: number | null }
  let slaStats: SlaStats | null = null
  const slaLocationId = locationId ?? null

  if (slaLocationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sla } = await (adminDb as any)
      .rpc('get_screen_sla_stats', { p_location_id: slaLocationId })
      .single()
    slaStats = sla as SlaStats | null
  }

  // Recent applications (last 10 with applicant name)
  let recentQuery = adminDb
    .from('applications')
    .select('id, status, created_at, applicants(name), locations(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (role === 'location_manager' && locationId) {
    recentQuery = recentQuery.eq('location_id', locationId)
  }

  const { data: recent } = await recentQuery

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">{today} · Last 30 days</p>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Applicants" value={totalActive} />
        <StatCard label="Hired (30d)" value={counts['hired'] ?? 0} highlight />
        <StatCard
          label="Speed-to-Call (median)"
          value={slaStats?.median_minutes != null ? `${slaStats.median_minutes}m` : '—'}
          sub="time from apply to screen"
        />
        <StatCard
          label="< 10 min Screen Rate"
          value={slaStats?.pct_under_10_min != null ? `${slaStats.pct_under_10_min}%` : '—'}
          sub="7-day window"
          highlight={
            slaStats?.pct_under_10_min != null && slaStats.pct_under_10_min >= 80
          }
        />
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Pipeline (last 30 days)
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map(({ status, label, color }) => (
            <div
              key={status}
              className={`rounded-lg px-3 py-3 text-center ${color}`}
            >
              <p className="text-2xl font-bold">{counts[status] ?? 0}</p>
              <p className="text-xs mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent applications */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Recent Applications
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(recent ?? []).length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No applications yet.</p>
          )}
          {(recent ?? []).map((app) => {
            const applicant = app.applicants as unknown as { name: string } | null
            const location = app.locations as unknown as { name: string } | null
            const stageInfo = PIPELINE_STAGES.find((s) => s.status === app.status)
            const age = formatAge(app.created_at)
            return (
              <div key={app.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {applicant?.name ?? '—'}
                  </p>
                  {role === 'company_admin' && (
                    <p className="text-xs text-gray-400 truncate">{location?.name ?? ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stageInfo?.color ?? 'bg-gray-100 text-gray-600'}`}>
                    {stageInfo?.label ?? app.status}
                  </span>
                  <span className="text-xs text-gray-400 w-14 text-right">{age}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
