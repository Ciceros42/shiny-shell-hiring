'use client'

import Link from 'next/link'
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

interface InterviewDetail {
  id: string
  status: string
  manager_rating: number | null
  notes: string | null
  interviewer_score: number | null
  interview_slots: { start_time: string } | null
}

interface OnboardingItem {
  id: string
  text: string
  completed: boolean
  completed_at: string | null
  order_index: number
}

interface DetailData {
  app: {
    id: string
    status: string
    created_at: string
    availability: Record<string, string[]> | null
    applicants: { id: string; name: string; phone: string; email: string | null; sms_opted_out: boolean } | null
    locations: { id: string; name: string } | null
    jobs: { id: string; title: string } | null
    interviews: Array<InterviewDetail>
  }
  screenResult: ScreenResult | null
  answers: Answer[]
  onboardingItems?: OnboardingItem[]
}

interface Props {
  appId: string | null
  app: AppListItem | null
  pipelineMode: 'suggestion' | 'assistant'
  onClose: () => void
  onAdvance: (id: string) => void
  onReject: (id: string) => void
  onHire: (id: string) => void
  onMarkInterviewed: (id: string) => void
  actionLoading: boolean
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

export default function ApplicantPanel({ appId, app, pipelineMode, onClose, onAdvance, onReject, onHire, onMarkInterviewed, actionLoading }: Props) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [editScore, setEditScore] = useState<number | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [onboardingItems, setOnboardingItems] = useState<OnboardingItem[]>([])
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!appId) { setDetail(null); return }
    setLoading(true)
    setDetail(null)
    setFetchError(null)
    setNotesSaved(false)
    fetch(`/api/admin/applications/${appId}/detail`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d)
        setOnboardingItems(d.onboardingItems ?? [])
        const latestInterview = d.app?.interviews?.[0]
        if (latestInterview) {
          setEditNotes(latestInterview.notes ?? '')
          setEditScore(latestInterview.interviewer_score ?? null)
        } else {
          setEditNotes('')
          setEditScore(null)
        }
      })
      .catch((err) => { setFetchError(String(err)); setLoading(false) })
      .finally(() => setLoading(false))
  }, [appId, retryCount])

  async function saveInterviewNotes(interviewId: string) {
    setSavingNotes(true)
    setNotesSaved(false)
    await fetch(`/api/admin/interviews/${interviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: editNotes || null, interviewer_score: editScore }),
    })
    setSavingNotes(false)
    setNotesSaved(true)
  }

  async function toggleOnboardingItem(itemId: string, completed: boolean) {
    setTogglingItemId(itemId)
    await fetch(`/api/admin/onboarding/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    setOnboardingItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, completed, completed_at: completed ? new Date().toISOString() : null } : i
    ))
    setTogglingItemId(null)
  }

  function openGuide() {
    if (!appId) return
    window.open(
      `/interview-guide/${appId}`,
      'interview-guide',
      'width=520,height=750,resizable=yes,scrollbars=yes'
    )
  }

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
          <div className="flex items-center gap-3">
            {detail?.app.applicants?.id && (
              <Link
                href={`/applicants/${detail.app.applicants.id}`}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
              >
                Full profile →
              </Link>
            )}
            {app && (app.status === 'scheduled' || app.status === 'interviewed') && (
              <button
                onClick={openGuide}
                className="text-xs font-semibold px-2.5 py-1 rounded-md text-white transition-colors"
                style={{ backgroundColor: '#7C3AED' }}
                title="Open interview guide in a new window"
              >
                Open Guide
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none mt-0.5"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          )}

          {!loading && !detail && fetchError && (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-red-500">Failed to load applicant details.</p>
              <button onClick={() => setRetryCount(c => c + 1)} className="text-sm text-blue-600 underline">Try again</button>
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

              {/* Availability */}
              {detail.app.availability && Object.keys(detail.app.availability).length > 0 && (
                <AvailabilityGrid availability={detail.app.availability} />
              )}

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

              {/* Onboarding checklist — hired applicants */}
              {detail.app.status === 'hired' && onboardingItems.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>
                    Onboarding Checklist
                  </h3>
                  <div className="space-y-2">
                    {onboardingItems.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                        style={{
                          borderColor: item.completed ? '#D1FAE5' : '#E5E7EB',
                          backgroundColor: item.completed ? '#F0FDF4' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          disabled={togglingItemId === item.id}
                          onChange={() => toggleOnboardingItem(item.id, !item.completed)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                        />
                        <span
                          className="text-sm"
                          style={{
                            color: item.completed ? '#15803d' : '#374151',
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}
                        >
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {onboardingItems.filter(i => i.completed).length}/{onboardingItems.length} complete
                  </p>
                </section>
              )}

              {/* Interviews */}
              {detail.app.interviews?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Interview</h3>
                  {detail.app.interviews.map((interview) => (
                    <div key={interview.id} className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 capitalize">{interview.status}</span>
                        {interview.interview_slots?.start_time && (
                          <span className="text-xs text-gray-400">
                            {new Date(interview.interview_slots.start_time).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Score (1–5 stars) */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">Interviewer score</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setEditScore(editScore === star ? null : star)}
                              className="text-xl leading-none transition-colors"
                              style={{ color: editScore !== null && star <= editScore ? '#F59E0B' : '#D1D5DB' }}
                            >
                              ★
                            </button>
                          ))}
                          {editScore !== null && (
                            <span className="text-xs text-gray-400 self-center ml-1">{editScore}/5</span>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Notes</p>
                        <textarea
                          value={editNotes}
                          onChange={(e) => { setEditNotes(e.target.value); setNotesSaved(false) }}
                          rows={3}
                          placeholder="How did the interview go? Strengths, concerns…"
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none resize-none"
                        />
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => saveInterviewNotes(interview.id)}
                            disabled={savingNotes}
                            className="text-xs font-medium text-white px-3 py-1.5 rounded disabled:opacity-50"
                            style={{ backgroundColor: 'var(--brand-primary)' }}
                          >
                            {savingNotes ? 'Saving…' : 'Save notes'}
                          </button>
                          {notesSaved && <span className="text-xs text-green-600">Saved</span>}
                        </div>
                      </div>
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
              disabled={actionLoading}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Processing…' : '✓ Advance to Interview'}
            </button>
            <button
              onClick={() => onReject(app.id)}
              disabled={actionLoading}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              ✗ Reject
            </button>
          </div>
        )}
        {app && app.status === 'scheduled' && (
          <div className="shrink-0 border-t border-gray-200 p-4">
            <button
              onClick={() => onMarkInterviewed(app.id)}
              disabled={actionLoading}
              className="w-full rounded-md py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#8B5CF6' }}
            >
              {actionLoading ? 'Processing…' : 'Mark as Interviewed'}
            </button>
          </div>
        )}
        {app && app.status === 'interviewed' && (
          <div className="shrink-0 border-t border-gray-200 p-4 flex gap-3">
            <button
              onClick={() => onHire(app.id)}
              disabled={actionLoading}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#059669' }}
            >
              {actionLoading ? 'Processing…' : '✓ Hire'}
            </button>
            <button
              onClick={() => onReject(app.id)}
              disabled={actionLoading}
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

const AVAIL_DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const AVAIL_DAY_LABELS: Record<string,string> = { mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun' }
const AVAIL_SHIFTS = ['morning','afternoon','evening']
const AVAIL_SHIFT_LABELS: Record<string,string> = { morning:'AM',afternoon:'PM',evening:'Eve' }

function AvailabilityGrid({ availability }: { availability: Record<string, string[]> }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-primary)' }}>Availability</h3>
      <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_1fr_1fr] bg-gray-50 border-b border-gray-200">
          <div />
          {AVAIL_SHIFTS.map(s => (
            <div key={s} className="py-1 text-center font-semibold text-gray-400 uppercase tracking-wide" style={{ fontSize: 10 }}>
              {AVAIL_SHIFT_LABELS[s]}
            </div>
          ))}
        </div>
        {AVAIL_DAYS.map((day, i) => {
          const shifts = availability[day] ?? []
          return (
            <div key={day} className={`grid grid-cols-[40px_1fr_1fr_1fr] ${i < AVAIL_DAYS.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="flex items-center justify-center font-semibold text-gray-400 py-1.5" style={{ fontSize: 10 }}>
                {AVAIL_DAY_LABELS[day]}
              </div>
              {AVAIL_SHIFTS.map(shift => {
                const on = shifts.includes(shift)
                return (
                  <div key={shift} className="flex items-center justify-center py-1.5">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: on ? 'var(--brand-primary)' : '#F3F4F6',
                        color: on ? '#fff' : '#D1D5DB',
                      }}
                    >
                      {on ? '✓' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
