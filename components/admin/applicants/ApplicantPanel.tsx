'use client'

import { useEffect, useState } from 'react'
import type { AppListItem } from './ApplicantsTree'

interface Answer {
  answer_text: string
  score: number | null
  ai_reasoning: string | null
  order_index: number
  questions: { variants: string[]; type: string } | null
}

interface ScreenResult {
  passed: boolean
  total_score: number | null
  threshold_at_time: number | null
  qualitative_summary: string | null
  manager_briefing: string | null
}

interface DetailData {
  app: {
    id: string
    status: string
    created_at: string
    applicants: { id: string; name: string; phone: string; email: string | null; sms_opted_out: boolean } | null
    locations: { id: string; name: string } | null
    jobs: { id: string; title: string } | null
    interviews: Array<{
      id: string
      status: string
      manager_rating: number | null
      interview_slots: { start_time: string } | null
    }>
  }
  screenResult: ScreenResult | null
  answers: Answer[]
}

interface Props {
  appId: string | null
  app: AppListItem | null
  pipelineMode: 'suggestion' | 'assistant'
  onClose: () => void
  onAdvance: (id: string) => void
  onReject: (id: string) => void
  actionLoading: string | null
}

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied', sms_sent: 'SMS Sent', screen_link_clicked: 'Link Opened',
  screening: 'On Call', screen_complete: 'Screen Done', passed: 'Passed',
  failed: 'Failed', scheduled: 'Interview Set', interviewed: 'Interviewed',
  hired: 'Hired', no_show: 'No Show', rejected: 'Rejected',
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-8 text-right">{score}</span>
    </div>
  )
}

export default function ApplicantPanel({ appId, app, pipelineMode, onClose, onAdvance, onReject, actionLoading }: Props) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!appId) { setDetail(null); return }
    setLoading(true)
    setDetail(null)
    fetch(`/api/admin/applications/${appId}/detail`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .finally(() => setLoading(false))
  }, [appId])

  const open = !!appId

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 8%, white)' }}>
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--brand-primary)' }}>{app?.applicantName ?? '—'}</p>
            <p className="text-sm text-gray-400">{app?.applicantPhone}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          )}

          {!loading && detail && (
            <div className="p-5 space-y-5">
              {/* Meta row */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Status</p>
                  <p className="font-medium text-gray-800">{STATUS_LABELS[detail.app.status] ?? detail.app.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Applied</p>
                  <p className="font-medium text-gray-800">{new Date(detail.app.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Location</p>
                  <p className="font-medium text-gray-800">{detail.app.locations?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Position</p>
                  <p className="font-medium text-gray-800">{detail.app.jobs?.title ?? '—'}</p>
                </div>
                {detail.app.applicants?.email && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Email</p>
                    <p className="font-medium text-gray-800">{detail.app.applicants.email}</p>
                  </div>
                )}
              </div>

              {/* Screen Result */}
              {detail.screenResult && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Screen Result</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">AI Recommendation</span>
                      {(() => {
                        const s = detail.screenResult
                        const isReview = s.passed && s.total_score !== null && s.total_score < 70
                        return (
                          <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                            isReview ? 'bg-amber-100 text-amber-700'
                            : s.passed ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                          }`}>
                            {isReview ? 'Review' : s.passed ? 'Pass' : 'Fail'}
                          </span>
                        )
                      })()}
                    </div>
                    {detail.screenResult.total_score !== null && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">Score</span>
                          <span className="text-xs text-gray-400">
                            threshold: {detail.screenResult.threshold_at_time ?? '—'}
                          </span>
                        </div>
                        <ScoreBar score={detail.screenResult.total_score} max={100} />
                      </div>
                    )}
                    {detail.screenResult.manager_briefing && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Manager Briefing</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{detail.screenResult.manager_briefing}</p>
                      </div>
                    )}
                    {detail.screenResult.qualitative_summary && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">AI Summary</p>
                        <p className="text-sm text-gray-600 leading-relaxed italic">{detail.screenResult.qualitative_summary}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Answers */}
              {detail.answers.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>
                    Screen Answers ({detail.answers.length})
                  </h3>
                  <div className="space-y-3">
                    {detail.answers.map((a, i) => {
                      const question = a.questions?.variants?.[0] ?? `Question ${i + 1}`
                      return (
                        <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                          <p className="text-xs text-gray-400">{question}</p>
                          <p className="text-sm text-gray-800">{a.answer_text || '—'}</p>
                          {a.score !== null && (
                            <ScoreBar score={a.score} max={100} />
                          )}
                          {a.ai_reasoning && (
                            <p className="text-xs text-gray-400 leading-snug">{a.ai_reasoning}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Interviews */}
              {detail.app.interviews?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Interview</h3>
                  {detail.app.interviews.map((interview) => (
                    <div key={interview.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 capitalize">{interview.status}</span>
                        {interview.manager_rating !== null && (
                          <span className="font-medium text-gray-800">Rating: {interview.manager_rating}/5</span>
                        )}
                      </div>
                      {interview.interview_slots?.start_time && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(interview.interview_slots.start_time).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {app && pipelineMode === 'suggestion' && app.status === 'screen_complete' && (
          <div className="shrink-0 border-t border-gray-200 p-4 flex gap-3">
            <button
              onClick={() => onAdvance(app.id)}
              disabled={actionLoading === app.id}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === app.id ? 'Processing…' : '✓ Advance to Interview'}
            </button>
            <button
              onClick={() => onReject(app.id)}
              disabled={actionLoading === app.id}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              ✗ Reject
            </button>
          </div>
        )}
      </div>
    </>
  )
}
