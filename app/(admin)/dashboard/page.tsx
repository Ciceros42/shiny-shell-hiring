import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ApplicationStatus } from '@/lib/db/applications'

export const revalidate = 60

type StatusCount = Record<ApplicationStatus, number>

const PIPELINE_STAGES: {
  status: ApplicationStatus
  label: string
  dot: string
  group: 'neutral' | 'active' | 'positive' | 'negative'
}[] = [
  { status: 'applied',             label: 'Applied',       dot: 'bg-gray-400',    group: 'neutral'  },
  { status: 'sms_sent',            label: 'SMS Sent',      dot: 'bg-blue-400',    group: 'active'   },
  { status: 'screen_link_clicked', label: 'Link Opened',   dot: 'bg-indigo-400',  group: 'active'   },
  { status: 'screening',           label: 'On Call',       dot: 'bg-yellow-400',  group: 'active'   },
  { status: 'screen_complete',     label: 'Screen Done',   dot: 'bg-orange-400',  group: 'active'   },
  { status: 'passed',              label: 'Passed',        dot: 'bg-green-500',   group: 'positive' },
  { status: 'scheduled',           label: 'Interview Set', dot: 'bg-teal-500',    group: 'positive' },
  { status: 'interviewed',         label: 'Interviewed',   dot: 'bg-purple-500',  group: 'positive' },
  { status: 'hired',               label: 'Hired',         dot: 'bg-emerald-500', group: 'positive' },
  { status: 'no_show',             label: 'No Show',       dot: 'bg-rose-400',    group: 'negative' },
  { status: 'failed',              label: 'Failed',        dot: 'bg-red-400',     group: 'negative' },
  { status: 'rejected',            label: 'Rejected',      dot: 'bg-slate-400',   group: 'negative' },
]

export default async function DashboardPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

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

  type SlaStats = { median_minutes: number | null; pct_under_10_min: number | null }
  let slaStats: SlaStats | null = null
  if (locationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sla } = await (adminDb as any)
      .rpc('get_screen_sla_stats', { p_location_id: locationId })
      .single()
    slaStats = sla as SlaStats | null
  }

  let recentQuery = adminDb
    .from('applications')
    .select('id, status, created_at, applicants(name), locations(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(8)

  if (role === 'location_manager' && locationId) {
    recentQuery = recentQuery.eq('location_id', locationId)
  }

  const { data: recent } = await recentQuery

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--ui-text-primary)' }}>
          Dashboard
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--ui-text-muted)' }}>
          {today} · Last 30 days
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Applicants" value={totalActive} />
        <StatCard label="Hired (30d)" value={counts['hired'] ?? 0} accent />
        <StatCard
          label="Speed-to-Call"
          value={slaStats?.median_minutes != null ? `${slaStats.median_minutes}m` : '—'}
          sub="median, apply → screen"
        />
        <StatCard
          label="Under 10 min"
          value={slaStats?.pct_under_10_min != null ? `${slaStats.pct_under_10_min}%` : '—'}
          sub="of screen calls (7-day)"
          accent={slaStats?.pct_under_10_min != null && slaStats.pct_under_10_min >= 80}
        />
      </div>

      {/* Pipeline strip */}
      <Card className="mb-6">
        <p className="section-label mb-4">Pipeline · 30 days</p>
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.filter(s => s.group === 'neutral' || s.group === 'active').map(({ status, label, dot }) => (
              <StagePill key={status} label={label} count={counts[status] ?? 0} dot={dot} />
            ))}
          </div>
          <hr style={{ borderColor: 'var(--ui-border)' }} />
          <div className="flex flex-wrap gap-2 items-center">
            {PIPELINE_STAGES.filter(s => s.group === 'positive').map(({ status, label, dot }) => (
              <StagePill key={status} label={label} count={counts[status] ?? 0} dot={dot} />
            ))}
            <span className="mx-1 text-xs" style={{ color: 'var(--ui-border)' }}>|</span>
            {PIPELINE_STAGES.filter(s => s.group === 'negative').map(({ status, label, dot }) => (
              <StagePill key={status} label={label} count={counts[status] ?? 0} dot={dot} muted />
            ))}
          </div>
        </div>
      </Card>

      {/* Recent applications */}
      <Card>
        <div className="flex items-center justify-between mb-0 -mt-1 pb-3" style={{ borderBottom: '1px solid var(--ui-border)' }}>
          <p className="section-label">Recent Applications</p>
          <Link href="/applicants" className="text-[12px] font-medium transition-colors" style={{ color: 'var(--ui-accent)' }}>
            View all →
          </Link>
        </div>
        <div className="-mx-5 -mb-5">
          {(recent ?? []).length === 0 && (
            <p className="px-5 py-10 text-sm text-center" style={{ color: 'var(--ui-text-muted)' }}>
              No applications yet.
            </p>
          )}
          {(recent ?? []).map((app) => {
            const applicant = app.applicants as unknown as { name: string } | null
            const location = app.locations as unknown as { name: string } | null
            const stageInfo = PIPELINE_STAGES.find((s) => s.status === app.status)
            return (
              <div
                key={app.id}
                className="flex items-center justify-between px-5 py-3 transition-colors cursor-default"
                style={{ borderTop: '1px solid var(--ui-border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--ui-content-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ui-text-primary)' }}>
                    {applicant?.name ?? '—'}
                  </p>
                  {role !== 'location_manager' && (
                    <p className="text-[11px] truncate" style={{ color: 'var(--ui-text-muted)' }}>{location?.name ?? ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {stageInfo && (
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${stageInfo.dot}`} />
                      <span className="text-[12px]" style={{ color: 'var(--ui-text-secondary)' }}>{stageInfo.label}</span>
                    </span>
                  )}
                  <span className="text-[11px] w-12 text-right" style={{ color: 'var(--ui-text-muted)' }}>
                    {formatAge(app.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{
        backgroundColor: 'var(--ui-card-bg)',
        borderColor: 'var(--ui-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <style>{`.section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-text-muted); }`}</style>
      {children}
    </div>
  )
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: accent ? 'var(--ui-accent-muted)' : 'var(--ui-card-bg)',
        borderColor: accent ? 'var(--ui-accent)' : 'var(--ui-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2"
        style={{ color: accent ? 'var(--ui-accent)' : 'var(--ui-text-muted)' }}
      >
        {label}
      </p>
      <p
        className="text-[26px] font-bold leading-none"
        style={{ color: accent ? 'var(--ui-accent)' : 'var(--ui-text-primary)' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: 'var(--ui-text-muted)' }}>{sub}</p>}
    </div>
  )
}

function StagePill({ label, count, dot, muted }: { label: string; count: number; dot: string; muted?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{
        backgroundColor: muted ? 'transparent' : 'var(--ui-content-bg)',
        border: `1px solid var(--ui-border)`,
        color: muted ? 'var(--ui-text-muted)' : 'var(--ui-text-secondary)',
      }}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
      <span className="font-bold" style={{ color: muted ? 'var(--ui-text-muted)' : 'var(--ui-text-primary)' }}>
        {count}
      </span>
    </span>
  )
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
