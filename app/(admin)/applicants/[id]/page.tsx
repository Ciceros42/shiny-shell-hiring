import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-gray-100 text-gray-700', sms_sent: 'bg-blue-50 text-blue-700',
  screen_link_clicked: 'bg-indigo-50 text-indigo-700', screening: 'bg-yellow-50 text-yellow-700',
  screen_complete: 'bg-orange-50 text-orange-700', passed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700', scheduled: 'bg-teal-50 text-teal-700',
  interviewed: 'bg-purple-50 text-purple-700', hired: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-rose-50 text-rose-700', rejected: 'bg-slate-100 text-slate-600',
}
const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied', sms_sent: 'SMS Sent', screen_link_clicked: 'Link Opened',
  screening: 'On Call', screen_complete: 'Screen Done', passed: 'Passed',
  failed: 'Failed', scheduled: 'Interview Set', interviewed: 'Interviewed',
  hired: 'Hired', no_show: 'No Show', rejected: 'Rejected',
}

type Params = { id: string }

export default async function ApplicantDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch applicant — RLS ensures the manager can only see applicants linked to their location
  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name, phone, email, sms_opted_out, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!applicant) notFound()

  // Fetch all applications for this applicant
  const { data: appRows } = await supabase
    .from('applications')
    .select(`
      id, status, created_at, location_id,
      locations(name),
      screen_results(passed, total_score, threshold_at_time, qualitative_summary, manager_briefing, created_at),
      interviews(id, status, manager_rating, interview_slots(start_time))
    `)
    .eq('applicant_id', id)
    .order('created_at', { ascending: false })

  type ScreenResultRow = {
    passed: boolean
    total_score: number
    threshold_at_time: number
    qualitative_summary: string
    manager_briefing: string | null
    created_at: string
  }
  type InterviewRow = {
    id: string
    status: string
    manager_rating: string | null
    interview_slots: { start_time: string }[]
  }
  type AppDetail = {
    id: string
    status: string
    created_at: string
    location_id: string
    locations: { name: string } | null
    // Supabase returns reverse-FK relations as arrays
    screen_results: ScreenResultRow[]
    interviews: InterviewRow[]
  }

  const apps = (appRows ?? []) as unknown as AppDetail[]

  return (
    <div className="p-8 max-w-3xl">
      {/* Back */}
      <Link href="/applicants" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to Applicants
      </Link>

      {/* Applicant card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{applicant.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{applicant.phone}</p>
            {applicant.email && (
              <p className="text-sm text-gray-500">{applicant.email}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {applicant.sms_opted_out && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                SMS opted out
              </span>
            )}
            <p className="text-xs text-gray-400 mt-1">
              First seen {new Date(applicant.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Application history */}
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Applications ({apps.length})
      </h2>

      {apps.length === 0 && (
        <p className="text-sm text-gray-400">No applications found.</p>
      )}

      <div className="space-y-4">
        {apps.map((app) => {
          const sr = app.screen_results?.[0] ?? null
          // Pick the most recent non-cancelled interview
          const interview = app.interviews?.find(
            (i) => i.status !== 'cancelled' && i.status !== 'rescheduled'
          ) ?? app.interviews?.[0] ?? null
          const slotTime = interview?.interview_slots?.[0]?.start_time ?? null
          const pct = sr ? Math.round((sr.total_score / Math.max(sr.threshold_at_time, 1)) * 100) : null

          return (
            <div key={app.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* App header */}
              <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {app.locations?.name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[app.status] ?? app.status}
                </span>
              </div>

              {/* Screen result */}
              {sr && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Screen Result</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${sr.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {sr.passed ? 'PASS' : 'FAIL'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {sr.total_score}/{sr.threshold_at_time} pts
                      </span>
                      {pct !== null && (
                        <ScoreBar pct={Math.min(pct, 100)} passed={sr.passed} />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{sr.qualitative_summary}</p>
                  {sr.manager_briefing && (
                    <details className="mt-3">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                        Manager briefing
                      </summary>
                      <p className="mt-2 text-sm text-gray-600 leading-relaxed bg-blue-50 rounded-md p-3">
                        {sr.manager_briefing}
                      </p>
                    </details>
                  )}
                </div>
              )}

              {/* Interview */}
              {interview && (
                <div className="px-5 py-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Interview</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        interview.status === 'scheduled' ? 'bg-teal-50 text-teal-700' :
                        interview.status === 'completed' ? 'bg-purple-50 text-purple-700' :
                        interview.status === 'no_show' ? 'bg-rose-50 text-rose-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {interview.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {slotTime && (
                        <span>{new Date(slotTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      )}
                      {interview.manager_rating && (
                        <span className={`font-medium ${
                          interview.manager_rating === 'thumbs_up' ? 'text-green-600' :
                          interview.manager_rating === 'thumbs_down' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {interview.manager_rating === 'thumbs_up' ? '👍' :
                           interview.manager_rating === 'thumbs_down' ? '👎' : '🤔'}
                        </span>
                      )}
                      <Link
                        href={`/admin/interview/${interview.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScoreBar({ pct, passed }: { pct: number; passed: boolean }) {
  return (
    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${passed ? 'bg-green-500' : 'bg-red-400'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
