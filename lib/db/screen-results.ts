import { adminDb } from '@/lib/supabase/admin'
import type { ScoredAnswer } from '@/lib/scoring/engine'

export interface ScreenResult {
  id: string
  applicationId: string
  passed: boolean
  hardFailQuestionId: string | null
  hardFailAnswer: string | null
  qualitativeSummary: string
  managerBriefing: string | null
  scoresJson: Record<string, unknown>
  totalScore: number
  thresholdAtTime: number
  notifiedAt: string | null
  createdAt: string
}

export async function saveScreenResult({
  applicationId,
  passed,
  failReason,
  qualitativeSummary,
  managerBriefing,
  scoredAnswers,
  totalScore,
  thresholdAtTime,
}: {
  applicationId: string
  passed: boolean
  failReason: string | null
  qualitativeSummary: string
  managerBriefing: string
  scoredAnswers: ScoredAnswer[]
  totalScore: number
  thresholdAtTime: number
}): Promise<ScreenResult> {
  // Parse hard_filter fail reason: "hard_filter:questionId"
  let hardFailQuestionId: string | null = null
  let hardFailAnswer: string | null = null
  if (failReason?.startsWith('hard_filter:')) {
    hardFailQuestionId = failReason.split(':')[1] ?? null
    const failedAnswer = scoredAnswers.find((a) => a.questionId === hardFailQuestionId)
    hardFailAnswer = failedAnswer?.answerText ?? null
  }

  const scoresJson = Object.fromEntries(
    scoredAnswers.map((a) => [a.questionId, { score: a.score, reasoning: a.reasoning }])
  )

  const { data, error } = await adminDb
    .from('screen_results')
    .upsert(
      {
        application_id: applicationId,
        passed,
        hard_fail_question_id: hardFailQuestionId,
        hard_fail_answer: hardFailAnswer,
        qualitative_summary: qualitativeSummary,
        manager_briefing: managerBriefing,
        scores_json: scoresJson,
        total_score: totalScore,
        threshold_at_time: thresholdAtTime,
      },
      { onConflict: 'application_id' }
    )
    .select()
    .single()

  if (error) throw new Error(`saveScreenResult failed: ${error.message}`)
  return mapScreenResult(data!)
}

export async function getScreenResult(applicationId: string): Promise<ScreenResult | null> {
  const { data } = await adminDb
    .from('screen_results')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle()
  return data ? mapScreenResult(data) : null
}

export async function markScreenResultNotified(applicationId: string): Promise<void> {
  const { error } = await adminDb
    .from('screen_results')
    .update({ notified_at: new Date().toISOString() })
    .eq('application_id', applicationId)
  if (error) throw new Error(`markScreenResultNotified failed: ${error.message}`)
}

function mapScreenResult(row: Record<string, unknown>): ScreenResult {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    passed: row.passed as boolean,
    hardFailQuestionId: (row.hard_fail_question_id as string | null) ?? null,
    hardFailAnswer: (row.hard_fail_answer as string | null) ?? null,
    qualitativeSummary: row.qualitative_summary as string,
    managerBriefing: (row.manager_briefing as string | null) ?? null,
    scoresJson: (row.scores_json as Record<string, unknown>) ?? {},
    totalScore: (row.total_score as number) ?? 0,
    thresholdAtTime: (row.threshold_at_time as number) ?? 0,
    notifiedAt: (row.notified_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}
