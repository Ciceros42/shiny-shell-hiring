'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  appId: string
  applicantName: string
  jobTitle: string
  locationName: string
  meetLink: string | null
  screenResult: {
    passed: boolean
    totalScore: number | null
    summary: string | null
    briefing: string | null
  } | null
  answers: { question: string; answer: string; score: number | null }[]
  interviewQuestions: { id: string; text: string; hint: string | null }[]
  interview: {
    id: string
    notes: string | null
    score: number | null
    startTime: string | null
  } | null
}

function ScoreColor(score: number) {
  return score >= 70 ? '#16a34a' : score >= 45 ? '#ca8a04' : '#dc2626'
}

export default function InterviewGuideClient({
  appId, applicantName, jobTitle, locationName,
  meetLink, screenResult, answers, interviewQuestions, interview,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState(interview?.notes ?? '')
  const [score, setScore] = useState<number | null>(interview?.score ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [section, setSection] = useState<'questions' | 'screen' | 'notes'>('questions')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function toggleQ(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (!interview) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaved(false)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await fetch(`/api/admin/interviews/${interview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null, interviewer_score: score }),
      })
      setSaving(false)
      setSaved(true)
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [notes, score, interview])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: active ? 600 : 500,
    color: active ? '#111827' : '#6B7280',
    background: 'none', border: 'none', borderBottom: active ? '2px solid #111827' : '2px solid transparent',
    cursor: 'pointer', transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#111827', color: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {applicantName}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {jobTitle}{locationName ? ` · ${locationName}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {screenResult && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                background: screenResult.passed ? '#14532d' : '#7f1d1d',
                color: screenResult.passed ? '#86efac' : '#fca5a5',
              }}>
                {screenResult.totalScore ?? '?'} — {screenResult.passed ? 'Pass' : 'Fail'}
              </span>
            )}
            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                  background: '#1d4ed8', color: '#fff', textDecoration: 'none',
                }}
              >
                Join Meet
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0, padding: '0 16px' }}>
        <button style={tabStyle(section === 'questions')} onClick={() => setSection('questions')}>
          Questions {checked.size > 0 ? `(${checked.size}/${interviewQuestions.length})` : ''}
        </button>
        <button style={tabStyle(section === 'screen')} onClick={() => setSection('screen')}>
          Screen Summary
        </button>
        <button style={tabStyle(section === 'notes')} onClick={() => setSection('notes')}>
          Notes {score !== null ? `· ${'★'.repeat(score)}` : ''}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* --- QUESTIONS --- */}
        {section === 'questions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {interviewQuestions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
                No interview questions set up yet.<br />
                <span style={{ fontSize: 12 }}>Add questions in Settings → Interview Questions.</span>
              </div>
            )}
            {interviewQuestions.map((q) => {
              const done = checked.has(q.id)
              return (
                <div
                  key={q.id}
                  onClick={() => toggleQ(q.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    borderRadius: 8, border: '1px solid', cursor: 'pointer',
                    borderColor: done ? '#D1FAE5' : '#E5E7EB',
                    background: done ? '#F0FDF4' : '#fff',
                    opacity: done ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, border: '2px solid',
                    borderColor: done ? '#16a34a' : '#D1D5DB', background: done ? '#16a34a' : 'transparent',
                    flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: done ? '#15803d' : '#111827', lineHeight: 1.4 }}>
                      {q.text}
                    </div>
                    {q.hint && (
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontStyle: 'italic' }}>{q.hint}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* --- SCREEN SUMMARY --- */}
        {section === 'screen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!screenResult && (
              <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No screen result available.</p>
            )}
            {screenResult?.briefing && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#C2410C', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manager Briefing</div>
                <div style={{ fontSize: 13, color: '#431407', lineHeight: 1.5 }}>{screenResult.briefing}</div>
              </div>
            )}
            {screenResult?.summary && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Summary</div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, fontStyle: 'italic' }}>{screenResult.summary}</div>
              </div>
            )}
            {answers.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Screen Answers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {answers.map((a, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>{a.question}</div>
                      <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.4 }}>{a.answer || '—'}</div>
                      {a.score !== null && (
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 3, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${a.score}%`, height: '100%', background: ScoreColor(a.score), borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: ScoreColor(a.score) }}>{a.score}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- NOTES --- */}
        {section === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!interview && (
              <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No interview scheduled for this application.</p>
            )}
            {interview && (
              <>
                {/* Stars */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Score</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setScore(score === s ? null : s)}
                        style={{
                          fontSize: 28, background: 'none', border: 'none', cursor: 'pointer',
                          color: score !== null && s <= score ? '#F59E0B' : '#D1D5DB',
                          transition: 'color 0.1s', lineHeight: 1,
                        }}
                      >
                        ★
                      </button>
                    ))}
                    {score !== null && (
                      <span style={{ fontSize: 12, color: '#6B7280', alignSelf: 'center', marginLeft: 4 }}>{score}/5</span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did it go? Strengths, concerns, culture fit…"
                    style={{
                      width: '100%', minHeight: 200, padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
                      border: '1px solid #E5E7EB', borderRadius: 8, resize: 'vertical', outline: 'none',
                      fontFamily: 'inherit', color: '#111827', background: '#fff',
                    }}
                  />
                  <div style={{ fontSize: 11, color: saving ? '#6B7280' : saved ? '#16a34a' : 'transparent', marginTop: 4 }}>
                    {saving ? 'Saving…' : 'Saved'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
