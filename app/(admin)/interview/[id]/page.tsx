import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/supabase/admin'
import HireButton from '@/components/admin/interview/HireButton'

export const revalidate = 0

type Params = { id: string }

export default async function InterviewPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  // Interview + slot + application + applicant + location + screen result
  const { data: interview } = await adminDb
    .from('interviews')
    .select(`
      id, status, manager_rating, meet_link, created_at,
      interview_slots(start_time, end_time),
      applications(
        id, status, question_set_id,
        applicants(id, name, phone),
        locations(name, timezone),
        screen_results(
          passed, total_score, threshold_at_time,
          qualitative_summary, manager_briefing,
          hard_fail_question_id, hard_fail_answer
        )
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!interview) notFound()

  type SlotRow = { start_time: string; end_time: string }
  type ApplicantRow = { id: string; name: string; phone: string }
  type LocationRow = { name: string; timezone: string }
  type ScreenResultRow = {
    passed: boolean
    total_score: number
    threshold_at_time: number
    qualitative_summary: string
    manager_briefing: string | null
    hard_fail_question_id: string | null
    hard_fail_answer: string | null
  }
  type AppRow = {
    id: string
    status: string
    question_set_id: string
    applicants: ApplicantRow | null
    locations: LocationRow | null
    screen_results: ScreenResultRow[]
  }

  const slot = interview.interview_slots as unknown as SlotRow | null
  const app = interview.applications as unknown as AppRow | null
  const applicant = app?.applicants ?? null
  const location = app?.locations ?? null
  const sr = app?.screen_results?.[0] ?? null

  // Fetch completed screen call for this application
  const { data: screenCallRow } = app
    ? await adminDb
        .from('screen_calls')
        .select('id, transcript, inflection_notes, started_at, ended_at, cost_usd')
        .eq('application_id', app.id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // Fetch screen answers with question text
  type AnswerWithQuestion = {
    id: string
    answer_text: string
    score: number | null
    ai_reasoning: string | null
    order_index: number
    questions: { variants: string[]; type: string; rubric: string | null; weight: number } | null
  }

  const { data: answerRows } = screenCallRow
    ? await adminDb
        .from('screen_answers')
        .select('id, answer_text, score, ai_reasoning, order_index, questions(variants, type, rubric, weight)')
        .eq('screen_call_id', screenCallRow.id)
        .order('order_index', { ascending: true })
    : { data: [] }

  const answers = (answerRows ?? []) as unknown as AnswerWithQuestion[]

  const timezone = location?.timezone ?? 'America/Denver'
  const slotStart = slot?.start_time
    ? new Date(slot.start_time).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: timezone,
      })
    : null

  const scorePct = sr
    ? Math.min(Math.round((sr.total_score / Math.max(sr.threshold_at_time, 1)) * 100), 100)
    : null

  return (
    <div className="p-8 max-w-3xl">
      {/* Back */}
      {applicant && (
        <Link
          href={`/applicants/${applicant.id}`}
          className="text-sm text-blue-600 hover:underline mb-6 inline-block"
        >
          ← {applicant.name}
        </Link>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{applicant?.name ?? '—'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{applicant?.phone}</p>
            <p className="text-sm text-gray-500">{location?.name}</p>
          </div>
          <div className="text-right space-y-1">
            {slotStart && (
              <p className="text-sm font-medium text-gray-900">{slotStart}</p>
            )}
            {interview.meet_link && (
              <a
                href={interview.meet_link as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                Join Meet
              </a>
            )}
            <InterviewStatusBadge status={interview.status} />
            {interview.manager_rating && (
              <p className="text-sm">
                {interview.manager_rating === 'thumbs_up' ? '👍 Good fit' :
                 interview.manager_rating === 'thumbs_down' ? '👎 Not a fit' : '🤔 Maybe'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hire button — shown when interview is scheduled or completed and app not yet hired */}
      {app && ['scheduled', 'completed', 'interviewed'].includes(interview.status) && (
        <div className="mb-6">
          <HireButton
            applicationId={app.id}
            applicantName={applicant?.name ?? 'this applicant'}
            alreadyHired={app.status === 'hired'}
          />
        </div>
      )}

      {/* Manager Briefing — Feature A */}
      {sr?.manager_briefing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-3">
            AI Manager Briefing
          </h2>
          <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
            {sr.manager_briefing}
          </p>
        </div>
      )}

      {/* Screen Score */}
      {sr && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Screen Result
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {sr.total_score} / {sr.threshold_at_time} pts
              </span>
              <span className={`text-sm font-bold ${sr.passed ? 'text-green-600' : 'text-red-600'}`}>
                {sr.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>

          {/* Score bar */}
          {scorePct !== null && (
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all ${sr.passed ? 'bg-green-500' : 'bg-red-400'}`}
                style={{ width: `${scorePct}%` }}
              />
            </div>
          )}

          <p className="text-sm text-gray-700 leading-relaxed">{sr.qualitative_summary}</p>

          {sr.hard_fail_answer && (
            <div className="mt-3 text-xs bg-red-50 border border-red-200 rounded-md px-3 py-2 text-red-700">
              <span className="font-semibold">Hard filter failed:</span> {sr.hard_fail_answer}
            </div>
          )}
        </div>
      )}

      {/* Q&A Breakdown */}
      {answers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Q&A Breakdown
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {answers.map((ans, i) => {
              const q = ans.questions
              const questionText = q?.variants?.[0] ?? `Question ${i + 1}`
              const isHardFilter = q?.type === 'hard_filter'
              const isScored = q?.type === 'scored'

              return (
                <div key={ans.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-medium text-gray-800 flex-1">{questionText}</p>
                    <div className="shrink-0 flex items-center gap-2">
                      {isHardFilter && (
                        <span className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                          filter
                        </span>
                      )}
                      {isScored && ans.score !== null && (
                        <ScoreChip score={ans.score} weight={q?.weight ?? 1} />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{ans.answer_text}</p>
                  {ans.ai_reasoning && (
                    <p className="text-xs text-gray-400 italic">{ans.ai_reasoning}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transcript */}
      {screenCallRow?.transcript && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <details>
            <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-700 uppercase tracking-wide hover:bg-gray-50 transition-colors list-none flex items-center justify-between">
              <span>Full Transcript</span>
              <span className="text-gray-400 text-xs font-normal normal-case">
                {screenCallRow.cost_usd != null ? `$${screenCallRow.cost_usd.toFixed(4)}` : ''}
              </span>
            </summary>
            <div className="px-5 pb-5 border-t border-gray-100">
              {screenCallRow.inflection_notes && (
                <div className="mt-3 mb-4 text-xs bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 text-yellow-800">
                  <span className="font-semibold">Inflection notes:</span> {screenCallRow.inflection_notes}
                </div>
              )}
              <pre className="mt-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-mono">
                {screenCallRow.transcript}
              </pre>
            </div>
          </details>
        </div>
      )}

      {!sr && !screenCallRow && (
        <div className="text-center py-12 text-sm text-gray-400">
          No screening data yet for this interview.
        </div>
      )}
    </div>
  )
}

function InterviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: 'bg-teal-50 text-teal-700',
    completed: 'bg-purple-50 text-purple-700',
    no_show: 'bg-rose-50 text-rose-700',
    cancelled: 'bg-gray-100 text-gray-600',
    rescheduled: 'bg-blue-50 text-blue-700',
  }
  const labels: Record<string, string> = {
    scheduled: 'Scheduled', completed: 'Completed', no_show: 'No Show',
    cancelled: 'Cancelled', rescheduled: 'Rescheduled',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function ScoreChip({ score, weight }: { score: number; weight: number }) {
  const color =
    score >= 80 ? 'bg-green-50 text-green-700' :
    score >= 50 ? 'bg-yellow-50 text-yellow-700' :
    'bg-red-50 text-red-700'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
      {score}
      {weight > 1 && <span className="opacity-60">×{weight}</span>}
    </span>
  )
}
