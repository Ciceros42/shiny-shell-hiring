import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const revalidate = 60

type SearchParams = { days?: string }

const FUNNEL_STAGES = [
  { status: 'applied',             label: 'Applied',       color: '#94A3B8' },
  { status: 'sms_sent',            label: 'SMS Sent',      color: '#60A5FA' },
  { status: 'screen_link_clicked', label: 'Link Opened',   color: '#818CF8' },
  { status: 'screening',           label: 'On Call',       color: '#FBBF24' },
  { status: 'screen_complete',     label: 'Screen Done',   color: '#FB923C' },
  { status: 'passed',              label: 'Passed',        color: '#4ADE80' },
  { status: 'scheduled',           label: 'Interview Set', color: '#2DD4BF' },
  { status: 'interviewed',         label: 'Interviewed',   color: '#A78BFA' },
  { status: 'hired',               label: 'Hired',         color: '#34D399' },
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

  let appQuery = adminDb
    .from('applications')
    .select('status, created_at, id, source')
    .eq('company_id', companyId)

  if (role === 'location_manager' && locationId) {
    appQuery = appQuery.eq('location_id', locationId)
  }
  if (since) appQuery = appQuery.gte('created_at', since)

  const { data: appRows } = await appQuery
  const allApps = appRows ?? []

  const STAGE_ORDER = [
    'applied', 'sms_sent', 'screen_link_clicked', 'screening',
    'screen_complete', 'passed', 'scheduled', 'interviewed', 'hired',
  ]

  const reachedCounts: Record<string, number> = {}
  for (const stage of FUNNEL_STAGES) {
    const stageIdx = STAGE_ORDER.indexOf(stage.status)
    reachedCounts[stage.status] = allApps.filter((a) => {
      const appIdx = STAGE_ORDER.indexOf(a.status)
      return appIdx >= stageIdx
    }).length
  }

  const topCount = reachedCounts['applied'] || 1
  const hiredCount = (allApps.filter((a) => a.status === 'hired')).length

  // Source breakdown
  const sourceCounts: Record<string, { total: number; hired: number }> = {}
  for (const app of allApps) {
    const src = (app.source as string | null) ?? 'direct'
    if (!sourceCounts[src]) sourceCounts[src] = { total: 0, hired: 0 }
    sourceCounts[src].total++
    if (app.status === 'hired') sourceCounts[src].hired++
  }
  const sourceRows = Object.entries(sourceCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([source, counts]) => ({ source, ...counts }))

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

  type SlaStats = { median_minutes: number | null; pct_under_10_min: number | null }
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--ui-text-primary)' }}>
            Analytics
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--ui-text-muted)' }}>
            {periodLabel} · {allApps.length} applications
          </p>
        </div>
        <PeriodPicker current={days} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Cost / Hire"
          value={costPerHire != null ? `$${costPerHire.toFixed(2)}` : '—'}
          sub={hiredCount > 0 ? `${hiredCount} hired` : 'no hires yet'}
          accent={hiredCount > 0}
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
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: 'var(--ui-card-bg)', borderColor: 'var(--ui-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-5" style={{ color: 'var(--ui-text-muted)' }}>
          Hiring Funnel
        </p>
        <div className="space-y-2.5">
          {FUNNEL_STAGES.map((stage, i) => {
            const count = reachedCounts[stage.status] ?? 0
            const prevCount = i > 0 ? (reachedCounts[FUNNEL_STAGES[i - 1].status] ?? 1) : topCount
            const convRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0
            const barPct = topCount > 0 ? Math.max((count / topCount) * 100, count > 0 ? 2 : 0) : 0

            return (
              <div key={stage.status} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--ui-text-secondary)' }}>
                    {stage.label}
                  </span>
                </div>
                <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--ui-content-bg)' }}>
                  <div
                    className="h-full rounded-lg transition-all"
                    style={{ width: `${barPct}%`, backgroundColor: stage.color, opacity: 0.85 }}
                  />
                </div>
                <div className="w-16 shrink-0 flex items-center gap-2">
                  <span className="text-sm font-bold w-7 text-right" style={{ color: 'var(--ui-text-primary)' }}>
                    {count}
                  </span>
                  {i > 0 && count > 0 && (
                    <span
                      className="text-[11px] font-medium"
                      style={{
                        color: convRate >= 70 ? '#16a34a' : convRate >= 40 ? '#ca8a04' : '#dc2626',
                      }}
                    >
                      {convRate}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>
          Each row counts applicants who reached that stage or beyond. % is relative to the previous stage.
        </p>
      </div>

      {/* Source breakdown */}
      {sourceRows.length > 1 && (
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ backgroundColor: 'var(--ui-card-bg)', borderColor: 'var(--ui-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: 'var(--ui-text-muted)' }}>
            Application Sources
          </p>
          <div className="space-y-2.5">
            {sourceRows.map(({ source, total, hired }) => {
              const pct = topCount > 0 ? Math.round((total / topCount) * 100) : 0
              const label = source === 'direct' ? 'Direct' : source === 'qr' ? 'QR Code' : source.charAt(0).toUpperCase() + source.slice(1)
              return (
                <div key={source} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-right">
                    <span className="text-[12px] font-medium" style={{ color: 'var(--ui-text-secondary)' }}>{label}</span>
                  </div>
                  <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--ui-content-bg)' }}>
                    <div className="h-full rounded-lg" style={{ width: `${pct}%`, backgroundColor: 'var(--ui-accent)', opacity: 0.7 }} />
                  </div>
                  <div className="w-24 shrink-0 flex items-center gap-2 text-[12px]">
                    <span className="font-bold" style={{ color: 'var(--ui-text-primary)' }}>{total}</span>
                    {hired > 0 && (
                      <span style={{ color: '#16a34a' }}>{hired} hired</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Drop-off */}
      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: 'var(--ui-card-bg)', borderColor: 'var(--ui-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: 'var(--ui-text-muted)' }}>
          Drop-off Analysis
        </p>
        <div className="space-y-2">
          {FUNNEL_STAGES.slice(1).map((stage, i) => {
            const count = reachedCounts[stage.status] ?? 0
            const prevStage = FUNNEL_STAGES[i]
            const prevCount = reachedCounts[prevStage.status] ?? 0
            const dropped = prevCount - count
            if (dropped <= 0) return null
            const dropPct = prevCount > 0 ? Math.round((dropped / prevCount) * 100) : 0
            return (
              <div key={stage.status} className="flex items-center justify-between text-[13px]">
                <span style={{ color: 'var(--ui-text-secondary)' }}>
                  {prevStage.label} → {stage.label}
                </span>
                <span
                  className="font-semibold"
                  style={{ color: dropPct >= 60 ? '#dc2626' : dropPct >= 30 ? '#ca8a04' : 'var(--ui-text-secondary)' }}
                >
                  {dropped} dropped ({dropPct}%)
                </span>
              </div>
            )
          })}
          {allApps.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--ui-text-muted)' }}>No data for this period.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean
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
      <p className="text-[22px] font-bold leading-none" style={{ color: accent ? 'var(--ui-accent)' : 'var(--ui-text-primary)' }}>
        {value}
      </p>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: 'var(--ui-text-muted)' }}>{sub}</p>}
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
    <div
      className="flex rounded-lg overflow-hidden text-[12px] font-medium"
      style={{ border: '1px solid var(--ui-border)' }}
    >
      {options.map((opt) => (
        <a
          key={opt.value}
          href={`?days=${opt.value}`}
          className="px-3 py-1.5 transition-colors"
          style={
            current === opt.value
              ? { backgroundColor: 'var(--ui-accent)', color: 'var(--ui-accent-fg)' }
              : { color: 'var(--ui-text-secondary)', backgroundColor: 'var(--ui-card-bg)' }
          }
        >
          {opt.label}
        </a>
      ))}
    </div>
  )
}
