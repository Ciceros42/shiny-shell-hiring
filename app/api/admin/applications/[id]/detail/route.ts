import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  // Load application + related data
  const { data: app } = await adminDb
    .from('applications')
    .select(`
      id, status, created_at, job_id,
      applicants(id, name, phone, email, sms_opted_out),
      locations(id, name),
      jobs(id, title),
      interviews(id, status, manager_rating, interview_slots(start_time))
    `)
    .eq('id', id)
    .single()

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Screen result
  const { data: sr } = await adminDb
    .from('screen_results')
    .select('application_id, passed, total_score, threshold_at_time, qualitative_summary, manager_briefing')
    .eq('application_id', id)
    .maybeSingle()

  // Answers
  const { data: screenCalls } = await adminDb
    .from('screen_calls')
    .select('id')
    .eq('application_id', id)
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

  return NextResponse.json({ app, screenResult: sr, answers })
}
