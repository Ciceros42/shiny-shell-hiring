import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const revalidate = 60

type SearchParams = { days?: string }

const FUNNEL_STAGES = [
  { status: 'applied',             label: 'Applied',       color: 'bg-gray-400' },
  { status: 'sms_sent',            label: 'SMS Sent',      color: 'bg-blue-400' },
  { status: 'screen_link_clicked', label: 'Link Opened',   color: 'bg-indigo-400' },
  { status: 'screening',           label: 'On Call',       color: 'bg-yellow-400' },
  { status: 'screen_complete',     label: 'Screen Done',   color: 'bg-orange-400' },
  { status: 'passed',              label: 'Passed',        color: 'bg-green-500' },
  { status: 'scheduled',           label: 'Interview Set', color: 'bg-teal-500' },
  { status: 'interviewed',         label: 'Interviewed',   color: 'bg-purple-500' },
  { status: 'hired',               label: 'Hired',         color: 'bg-emerald-500' },
] as const

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { days: daysParam } = await searchParams
  const days = daysParam ? parseInt(daysParam, 10) : 90
  const since = days === 0
    ? undefined
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId, locationId, role } = profile

  // --- Pipeline counts (admin client, explicitly scoped) ---
  let appQuery = adminDb
    .from('applications')
    .select('status, created_at, id')
    .eq('company_id', companyId)

  if (role === 'location_manager' && locationId) {
    appQuery = appQuery.eq('location_id', locationId)
  }
  if (since) appQuery = appQuery.gte('created_at', since)

  const { data: appRows } = await appQuery
  const allApps = appRows ?? []

  // Cumulative counts per stage — an app in 'hired' should count for every upstream stage too
  const STAGE_ORDER = [
    'applied', 'sms_sent', 'screen_link_clicked', 'screening',
    'screen_complete', 'passed', 'scheduled', 'interviewed', 'hired',
  ]
  // Count apps that REACHED each stage (status = this stage OR any later stage)
  const reachedCounts: Record<string, number> = {}
  for (const stage of FUNNEL_STAGES) {
    const stageIdx = STAGE_ORDER.indexOf(stage.status)
    reachedCounts[stage.status] = allApps.filter((a) => {
      const appIdx = STAGE_ORDER.indexOf(a.status)
      return appIdx >= stageIdx
    }).length
  }

  const topCount = reachedCounts['applied'] || 1

  // --- Cost metrics (admin client — sms_log has no user-facing RLS) ---
  const hiredAppIds = allApps
    .filter((a) => a.status === 'hired')
    .map((a) => a.id)

  const hiredCount = hiredAppIds.length

  let totalScreenCost = 0
  let totalSmsCost = 0
  let screenCallCount = 0

  if (allApps.length > 0) {
    const allAppIds = allApps.map((a) => a.id)

    const { data: screenCosts } = await adminDb
      .from('screen_calls')
      .select('cost_usd')
      .in('application_id', allAppIds)
      .not('cost_usd', 'is', null)

    for (const row of screenCosts ?? []) {
      totalScreenCost += (row.cost_usd as number) ?? 0
      screenCallCount++
    }

    const { data: smsCosts } = await adminDb
      .from('sms_log')
      .select('cost_usd')
      .in('application_id', allAppIds)
      .not('cost_usd', 'is', null)

    for (const row of smsCosts ?? []) {
      totalSmsCost += (row.cost_usd as number) ?? 0
    }
  }

  const totalCost = totalScreenCost + totalSmsCost
  const costPerHire = hiredCount > 0 ? totalCost / hiredCount : null
  const costPerScreen = screenCallCount > 0 ? totalScreenCost / screenCallCount : null

  // --- SLA stats ---
  type SlaStats = { median_minutes: number | null; pct_under_10_min: number | null }

  // Company admins have no location_id — fall back to first location in their company
  let slaLocationId = locationId ?? null
  if (!slaLocationId) {
    const { data: firstLoc } = await adminDb
      .from('locations')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()
    slaLocationId = firstLoc?.id ?? null
  }

  let slaStats: SlaStats | null = null
  if (slaLocationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sla } = await (adminDb as any)
      .rpc('get_screen_sla_stats', { p_location_id: slaLocationId })
      .single()
    slaStats = sla as SlaStats | null
  }

  const periodLabel = days === 0 ? 'All time' : `Last ${days} days`

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500">{periodLabel} · {allApps.length} applications</p>
        </div>
        <PeriodPicker current={days} />
      </div>

      {/* Cost metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Cost / Hire"
          value={costPerHire != null ? `$${costPerHire.toFixed(2)}` : '—'}
          sub={hiredCount > 0 ? `${hiredCount} hired` : 'no hires yet'}
          highlight={hiredCount > 0}
        />
        <MetricCard
          label="Total Spend"
          value={totalCost > 0 ? `$${totalCost.toFixed(2)}` : '$0'}
          sub="screen + SMS"
        />
        <MetricCard
          label="Avg Screen Cost"
          value={costPerScreen != null ? `$${costPerScreen.toFixed(3)}` : '—'}
          sub={`${screenCallCount} calls`}
        />
        <MetricCard
          label="Apply-to-Call"
          value={slaStats?.median_minutes != null ? `${slaStats.median_minutes}m` : '—'}
          sub={slaStats?.pct_under_10_min != null ? `${slaStats.pct_under_10_min}% < 10 min` : '7-day median'}
        />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5">
          Hiring Funnel
        </h2>
        <div className="space-y-3">
          {FUNNEL_STAGES.map((stage, i) => {
            const count = reachedCounts[stage.status] ?? 0
            const prevCount = i > 0 ? (reachedCounts[FUNNEL_STAGES[i - 1].status] ?? 1) : topCount
            const convRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0
            const barPct = topCount > 0 ? Math.max((count / topCount) * 100, count > 0 ? 1 : 0) : 0

            return (
              <div key={stage.status} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <span className="text-xs font-medium text-gray-600">{stage.label}</span>
                </div>
                <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${stage.color} transition-all`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 w-8 text-right">{count}</span>
                  {i > 0 && count > 0 && (
                    <span className={`text-xs ${convRate >= 70 ? 'text-green-600' : convRate >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {convRate}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Each row counts applicants who reached that stage or beyond. Rejected/failed applicants are excluded. Conversion % is relative to the previous stage.
        </p>
      </div>

      {/* Drop-off summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Drop-off Analysis
        </h2>
        <div className="space-y-2">
          {FUNNEL_STAGES.slice(1).map((stage, i) => {
            const count = reachedCounts[stage.status] ?? 0
            const prevStage = FUNNEL_STAGES[i]
            const prevCount = reachedCounts[prevStage.status] ?? 0
            const dropped = prevCount - count
            if (dropped <= 0) return null
            const dropPct = prevCount > 0 ? Math.round((dropped / prevCount) * 100) : 0
            return (
              <div key={stage.status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {prevStage.label} → {stage.label}
                </span>
                <span className={`font-medium ${dropPct >= 60 ? 'text-red-600' : dropPct >= 30 ? 'text-yellow-600' : 'text-gray-600'}`}>
                  {dropped} dropped ({dropPct}%)
                </span>
              </div>
            )
          })}
          {allApps.length === 0 && (
            <p className="text-sm text-gray-400">No data for this period.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function PeriodPicker({ current }: { current: number }) {
  const options = [
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: 'All', value: 0 },
  ]
  return (
    <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
      {options.map((opt) => (
        <a
          key={opt.value}
          href={`?days=${opt.value}`}
          className={`px-3 py-1.5 font-medium transition-colors ${
            current === opt.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </a>
      ))}
    </div>
  )
}
