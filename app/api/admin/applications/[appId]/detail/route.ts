import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ appId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { appId } = await params

  // Load application + related data and screen result in parallel
  const [{ data: app, error: appError }, { data: sr }] = await Promise.all([
    adminDb
      .from('applications')
      .select(`
        id, status, created_at, job_id, availability,
        applicants(id, name, phone, email, sms_opted_out),
        locations(id, name),
        jobs(id, title),
        interviews(id, status, manager_rating, notes, interviewer_score, interview_slots(start_time))
      `)
      .eq('id', appId)
      .eq('company_id', profile.companyId)
      .single(),
    adminDb
      .from('screen_results')
      .select('application_id, passed, total_score, threshold_at_time, qualitative_summary, manager_briefing')
      .eq('application_id', appId)
      .maybeSingle(),
  ])

  if (appError || !app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Onboarding checklist items (for hired applicants)
  const { data: onboardingItems } = await adminDb
    .from('onboarding_items')
    .select('id, text, completed, completed_at, order_index')
    .eq('application_id', appId)
    .order('order_index', { ascending: true })

  // Answers
  const { data: screenCalls } = await adminDb
    .from('screen_calls')
    .select('id')
    .eq('application_id', appId)
    .eq('status', 'completed')

  let answers: unknown[] = []
  if (screenCalls && screenCalls.length > 0) {
    const { data: rawAnswers } = await adminDb
      .from('screen_answers')
      .select('answer_text, score, ai_reasoning, order_index, questions(variants, type)')
      .in('screen_call_id', screenCalls.map((s) => s.id))
      .order('order_index', { ascending: true })
    answers = rawAnswers ?? []
  }

  return NextResponse.json({ app, screenResult: sr, answers, onboardingItems: onboardingItems ?? [] })
}
