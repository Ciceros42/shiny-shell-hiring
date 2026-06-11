import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/supabase/admin'
import SimulateCallButton from '@/components/admin/applicants/SimulateCallButton'
import { getApplicationResponses } from '@/lib/db/application-forms'

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

  const { data: applicant } = await adminDb
    .from('applicants')
    .select('id, name, phone, email, sms_opted_out, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!applicant) notFound()

  const { data: appRows } = await adminDb
    .from('applications')
    .select(`
      id, status, created_at, location_id,
      locations(name),
      interviews(id, status, manager_rating, interview_slots(start_time))
    `)
    .eq('applicant_id', id)
    .order('created_at', { ascending: false })

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
    interviews: InterviewRow[]
  }

  const apps = (appRows ?? []) as unknown as AppDetail[]
  const appIds = apps.map((a) => a.id)

  // Fetch application form responses for all applications
  const formResponsesByApp: Record<string, Awaited<ReturnType<typeof getApplicationResponses>>> = {}
  await Promise.all(
    appIds.map(async (appId) => {
      const responses = await getApplicationResponses(appId)
      if (responses.length > 0) formResponsesByApp[appId] = responses
    })
  )

  // Fetch screen_results via adminDb — RLS requires manager_user_id linkage which may not be set
  type ScreenResultRow = {
    application_id: string
    passed: boolean
    total_score: number
    threshold_at_time: number
    qualitative_summary: string
    manager_briefing: string | null
  }
  const screenResultsByApp: Record<string, ScreenResultRow> = {}
  if (appIds.length > 0) {
    const { data: srRows } = await adminDb
      .from('screen_results')
      .select('application_id, passed, total_score, threshold_at_time, qualitative_summary, manager_briefing')
      .in('application_id', appIds)
    for (const sr of srRows ?? []) {
      screenResultsByApp[(sr as ScreenResultRow).application_id] = sr as ScreenResultRow
    }
  }

  // Fetch per-question answer breakdowns via admin client
  type AnswerRow = {
    applicationId: string
    questionText: string
    questionType: string
    answerText: string
    score: number | null
    aiReasoning: string | null
    orderIndex: number
  }

  const answersByApp: Record<string, AnswerRow[]> = {}

  if (appIds.length > 0) {
    const { data: screenCalls } = await adminDb
      .from('screen_calls')
      .select('id, application_id')
      .in('application_id', appIds)
      .eq('status', 'completed')

    if (screenCalls && screenCalls.length > 0) {
      const screenCallIds = screenCalls.map((sc) => sc.id)

      const { data: answers } = await adminDb
        .from('screen_answers')
        .select('screen_call_id, answer_text, score, ai_reasoning, order_index, questions(variants, type)')
        .in('screen_call_id', screenCallIds)
        .order('order_index', { ascending: true })

      for (const ans of answers ?? []) {
        const sc = screenCalls.find((s) => s.id === ans.screen_call_id)
        if (!sc) continue
        const appId = sc.application_id
        if (!answersByApp[appId]) answersByApp[appId] = []
        const q = ans.questions as unknown as { variants: string[]; type: string } | null
        answersByApp[appId].push({
          applicationId: appId,
          questionText: q?.variants?.[0] ?? '—',
          questionType: q?.type ?? 'scored',
          answerText: ans.answer_text,
          score: ans.score as number | null,
          aiReasoning: ans.ai_reasoning as string | null,
          orderIndex: ans.order_index,
        })
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/applicants" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to Applicants
      </Link>

      {/* Applicant card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{applicant.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{applicant.phone}</p>
            {applicant.email && <p className="text-sm text-gray-500">{applicant.email}</p>}
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

      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Applications ({apps.length})
      </h2>

      {apps.length === 0 && <p className="text-sm text-gray-400">No applications found.</p>}

      <div className="space-y-4">
        {apps.map((app) => {
          const sr = screenResultsByApp[app.id] ?? null
          const formResponses = formResponsesByApp[app.id] ?? []
          const interview = app.interviews?.find(
            (i) => i.status !== 'cancelled' && i.status !== 'rescheduled'
          ) ?? app.interviews?.[0] ?? null
          const slotTime = interview?.interview_slots?.[0]?.start_time ?? null
          const answers = answersByApp[app.id] ?? []

          return (
            <div key={app.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{app.locations?.name ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[app.status] ?? app.status}
                </span>
              </div>

              {/* Application form responses */}
              {formResponses.length > 0 && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Application Responses</p>
                  <div className="space-y-3">
                    {formResponses.map((r, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium text-gray-700">{r.questionText}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {r.selectedOptions.map((opt) => (
                            <span key={opt} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{opt}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulate call button — only shown when no screen result yet */}
              {!sr && !['passed', 'failed', 'scheduled', 'interviewed', 'hired'].includes(app.status) && (
                <div className="px-5 py-3 border-b border-gray-100">
                  <SimulateCallButton applicationId={app.id} />
                </div>
              )}

              {/* Screen result */}
              {sr && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Screen Result</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${sr.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {sr.passed ? 'PASS' : 'FAIL'}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{sr.total_score}</span>
                      <span className="text-xs text-gray-400">/ {sr.threshold_at_time} to pass</span>
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sr.passed ? 'bg-green-500' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(sr.total_score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{sr.qualitative_summary}</p>
                  {sr.manager_briefing && (
                    <details className="mt-3">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:underline">Manager briefing</summary>
                      <p className="mt-2 text-sm text-gray-600 leading-relaxed bg-blue-50 rounded-md p-3">
                        {sr.manager_briefing}
                      </p>
                    </details>
                  )}
                </div>
              )}

              {/* Per-question answer breakdown */}
              {answers.length > 0 && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Answer Breakdown</p>
                  <div className="space-y-4">
                    {answers.map((ans, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-gray-800">{ans.questionText}</p>
                          {ans.questionType === 'scored' && ans.score !== null && (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold ${
                                ans.score >= 75 ? 'text-green-600' :
                                ans.score >= 40 ? 'text-yellow-600' : 'text-red-500'
                              }`}>
                                {ans.score}/100
                              </span>
                              <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    ans.score >= 75 ? 'bg-green-500' :
                                    ans.score >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${ans.score}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {ans.questionType === 'hard_filter' && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">filter</span>
                          )}
                          {ans.questionType === 'informational' && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">info</span>
                          )}
                        </div>
                        <p className="text-gray-600 bg-gray-50 rounded px-3 py-2">{ans.answerText}</p>
                        {ans.aiReasoning && (
                          <p className="text-xs text-gray-400 mt-1 italic">{ans.aiReasoning}</p>
                        )}
                      </div>
                    ))}
                  </div>
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
                      <Link href={`/interview/${interview.id}`} className="text-blue-600 hover:underline">
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
