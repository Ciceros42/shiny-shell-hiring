import { adminDb } from '@/lib/supabase/admin'

export interface ScreenCall {
  id: string
  applicationId: string
  screenLinkId: string
  vapiCallId: string | null
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'disconnected'
  transcript: string | null
  inflectionNotes: string | null
  startedAt: string | null
  endedAt: string | null
  costUsd: number | null
}

export interface ScreenAnswer {
  id: string
  screenCallId: string
  questionId: string
  answerText: string
  score: number | null
  aiReasoning: string | null
  orderIndex: number
}

export async function createScreenCall({
  applicationId,
  screenLinkId,
  vapiCallId,
}: {
  applicationId: string
  screenLinkId: string
  vapiCallId: string
}): Promise<ScreenCall> {
  const { data, error } = await adminDb
    .from('screen_calls')
    .insert({
      application_id: applicationId,
      screen_link_id: screenLinkId, // Fix 5: NOT NULL — must always be passed
      vapi_call_id: vapiCallId,
      status: 'initiated',
      started_at: new Date().toISOString(), // Feature C: set before Vapi response for SLA metric
    })
    .select()
    .single()

  if (error) throw new Error(`createScreenCall failed: ${error.message}`)
  return mapScreenCall(data!)
}

export async function getScreenCallByVapiId(vapiCallId: string): Promise<ScreenCall | null> {
  const { data } = await adminDb
    .from('screen_calls')
    .select('*')
    .eq('vapi_call_id', vapiCallId)
    .maybeSingle()
  return data ? mapScreenCall(data) : null
}

export async function updateScreenCall(
  id: string,
  fields: {
    status?: ScreenCall['status']
    transcript?: string
    inflectionNotes?: string
    endedAt?: Date
    costUsd?: number | null
  }
) {
  const update: Record<string, unknown> = {}
  if (fields.status !== undefined) update.status = fields.status
  if (fields.transcript !== undefined) update.transcript = fields.transcript
  if (fields.inflectionNotes !== undefined) update.inflection_notes = fields.inflectionNotes
  if (fields.endedAt !== undefined) update.ended_at = fields.endedAt.toISOString()
  if (fields.costUsd !== undefined) update.cost_usd = fields.costUsd

  const { error } = await adminDb.from('screen_calls').update(update).eq('id', id)
  if (error) throw new Error(`updateScreenCall failed: ${error.message}`)
}

export async function saveScreenAnswerScores(
  scoredAnswers: Array<{ questionId: string; score: number; reasoning: string }>
) {
  for (const a of scoredAnswers) {
    await adminDb
      .from('screen_answers')
      .update({ score: a.score, ai_reasoning: a.reasoning })
      .eq('question_id', a.questionId)
  }
}

export async function updateScreenCallStatus(
  id: string,
  status: ScreenCall['status'],
  extra?: { transcript?: string; inflectionNotes?: string; endedAt?: string; costUsd?: number }
) {
  const { error } = await adminDb
    .from('screen_calls')
    .update({
      status,
      ...(extra?.transcript !== undefined && { transcript: extra.transcript }),
      ...(extra?.inflectionNotes !== undefined && { inflection_notes: extra.inflectionNotes }),
      ...(extra?.endedAt !== undefined && { ended_at: extra.endedAt }),
      ...(extra?.costUsd !== undefined && { cost_usd: extra.costUsd }),
    })
    .eq('id', id)
  if (error) throw new Error(`updateScreenCallStatus failed: ${error.message}`)
}

export async function updateApplicationStatusByVapiId(vapiCallId: string, status: string) {
  const { data: screenCall } = await adminDb
    .from('screen_calls')
    .select('application_id')
    .eq('vapi_call_id', vapiCallId)
    .maybeSingle()

  if (!screenCall) return

  await adminDb
    .from('applications')
    .update({ status })
    .eq('id', screenCall.application_id)
}

export async function upsertScreenAnswer({
  screenCallId,
  questionId,
  answerText,
}: {
  screenCallId: string
  questionId: string
  answerText: string
}) {
  const { error } = await adminDb.from('screen_answers').upsert(
    {
      screen_call_id: screenCallId,
      question_id: questionId,
      answer_text: answerText,
    },
    { onConflict: 'screen_call_id,question_id' }
  )
  if (error) throw new Error(`upsertScreenAnswer failed: ${error.message}`)
}

export async function getScreenAnswers(screenCallId: string): Promise<ScreenAnswer[]> {
  const { data } = await adminDb
    .from('screen_answers')
    .select('*')
    .eq('screen_call_id', screenCallId)
    .order('order_index', { ascending: true })
  return (data ?? []).map(mapScreenAnswer)
}

function mapScreenCall(row: Record<string, unknown>): ScreenCall {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    screenLinkId: row.screen_link_id as string,
    vapiCallId: (row.vapi_call_id as string | null) ?? null,
    status: row.status as ScreenCall['status'],
    transcript: (row.transcript as string | null) ?? null,
    inflectionNotes: (row.inflection_notes as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    costUsd: (row.cost_usd as number | null) ?? null,
  }
}

function mapScreenAnswer(row: Record<string, unknown>): ScreenAnswer {
  return {
    id: row.id as string,
    screenCallId: row.screen_call_id as string,
    questionId: row.question_id as string,
    answerText: row.answer_text as string,
    score: (row.score as number | null) ?? null,
    aiReasoning: (row.ai_reasoning as string | null) ?? null,
    orderIndex: (row.order_index as number) ?? 0,
  }
}
