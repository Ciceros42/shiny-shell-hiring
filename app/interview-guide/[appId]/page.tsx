import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import InterviewGuideClient from '@/components/admin/interview/InterviewGuideClient'

interface Props { params: Promise<{ appId: string }> }

export default async function InterviewGuidePage({ params }: Props) {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')

  const { appId } = await params

  const [
    { data: app },
    { data: sr },
    { data: screenCalls },
    { data: iqRows },
  ] = await Promise.all([
    adminDb
      .from('applications')
      .select('id, status, applicants(name, phone), jobs(title), locations(name), interviews(id, notes, interviewer_score, meet_link, interview_slots(start_time))')
      .eq('id', appId)
      .eq('company_id', profile.companyId)
      .single(),
    adminDb
      .from('screen_results')
      .select('passed, total_score, qualitative_summary, manager_briefing')
      .eq('application_id', appId)
      .maybeSingle(),
    adminDb
      .from('screen_calls')
      .select('id')
      .eq('application_id', appId)
      .eq('status', 'completed'),
    adminDb
      .from('interview_questions')
      .select('id, text, hint, order_index')
      .eq('company_id', profile.companyId)
      .order('order_index', { ascending: true }),
  ])

  if (!app) redirect('/pipeline')

  let answers: { question: string; answer: string; score: number | null }[] = []
  if (screenCalls && screenCalls.length > 0) {
    const { data: rawAnswers } = await adminDb
      .from('screen_answers')
      .select('answer_text, score, order_index, questions(variants)')
      .in('screen_call_id', screenCalls.map((s) => s.id))
      .order('order_index', { ascending: true })

    answers = (rawAnswers ?? []).map((a) => ({
      question: (a.questions as unknown as { variants: string[] } | null)?.variants?.[0] ?? '',
      answer: a.answer_text,
      score: a.score as number | null,
    })).filter((a) => a.question)
  }

  type InterviewRow = { id: string; notes: string | null; interviewer_score: number | null; meet_link: string | null; interview_slots: { start_time: string } | null }
  const interview = ((app.interviews as unknown as InterviewRow[]) ?? [])[0] ?? null

  return (
    <html lang="en">
      <head>
        <title>Interview Guide</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', system-ui, sans-serif; font-size: 14px; background: #F8F9FA; color: #111827; }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        `}</style>
      </head>
      <body>
        <InterviewGuideClient
          appId={appId}
          applicantName={(app.applicants as unknown as { name: string } | null)?.name ?? '—'}
          jobTitle={(app.jobs as unknown as { title: string } | null)?.title ?? '—'}
          locationName={(app.locations as unknown as { name: string } | null)?.name ?? ''}
          meetLink={interview?.meet_link ?? null}
          screenResult={sr ? {
            passed: sr.passed as boolean,
            totalScore: sr.total_score as number | null,
            summary: sr.qualitative_summary as string | null,
            briefing: sr.manager_briefing as string | null,
          } : null}
          answers={answers}
          interviewQuestions={(iqRows ?? []).map((q) => ({ id: q.id, text: q.text, hint: q.hint as string | null }))}
          interview={interview ? {
            id: interview.id,
            notes: interview.notes,
            score: interview.interviewer_score,
            startTime: interview.interview_slots?.start_time ?? null,
          } : null}
        />
      </body>
    </html>
  )
}
