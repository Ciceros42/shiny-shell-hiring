import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { getApplicationById, updateApplicationStatus } from '@/lib/db/applications'
import { getQuestionSetWithQuestions } from '@/lib/db/question-sets'
import { saveScreenResult } from '@/lib/db/screen-results'
import { batchScoreAndSummarize, runPassFailEngine } from '@/lib/scoring/engine'

// Realistic test answers keyed by question type
const FAKE_ANSWERS: Record<string, string[]> = {
  hard_filter: ['yes', 'no'],
  scored: [
    'I have my own car and live about 10 minutes away so getting here is no problem.',
    'I can work Monday through Saturday, open availability on mornings and afternoons.',
    'I like physical work and being outside. I worked at a landscaping company last summer.',
    'I am a hard worker and I show up on time. I want steady hours and a good team.',
    'I have done customer service before at a grocery store so I am comfortable talking to people.',
  ],
  informational: [
    'Yes, I worked at a fast food restaurant for about a year.',
    'I have done some retail work but nothing too long term.',
  ],
}

function pickAnswer(type: string, index: number): string {
  const pool = FAKE_ANSWERS[type] ?? FAKE_ANSWERS.scored
  return pool[index % pool.length]
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { applicationId } = await req.json().catch(() => ({}))
  if (!applicationId) {
    return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 })
  }

  const application = await getApplicationById(applicationId)
  const questionSet = await getQuestionSetWithQuestions(application.questionSetId)

  // Create a dummy magic_link so screen_link_id NOT NULL constraint is satisfied
  const { data: magicLink, error: mlErr } = await adminDb
    .from('magic_links')
    .insert({
      type: 'screen',
      application_id: applicationId,
      token: `sim-token-${Date.now()}`,
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (mlErr) return NextResponse.json({ error: mlErr.message }, { status: 500 })

  // Create a fake screen_call row marked completed
  const fakeVapiId = `sim-${Date.now()}`
  const { data: screenCall, error: scErr } = await adminDb
    .from('screen_calls')
    .insert({
      application_id: applicationId,
      screen_link_id: magicLink!.id,
      vapi_call_id: fakeVapiId,
      status: 'completed',
      transcript: '[Simulated call — no real transcript]',
      started_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      cost_usd: 0,
    })
    .select('id')
    .single()

  if (scErr) return NextResponse.json({ error: scErr.message }, { status: 500 })

  // Insert one fake answer per question
  const answerRows = questionSet.questions.map((q, i) => ({
    screen_call_id: screenCall!.id,
    question_id: q.id,
    answer_text: pickAnswer(q.type, i),
    order_index: q.order_index,
  }))

  await adminDb.from('screen_answers').insert(answerRows)

  // Run scoring pipeline
  const answers = answerRows.map((a) => ({
    questionId: a.question_id,
    answerText: a.answer_text,
  }))

  const batchResult = await batchScoreAndSummarize(answers, questionSet.questions)

  // Update scores on the rows we just inserted
  for (const scored of batchResult.scoredAnswers) {
    await adminDb
      .from('screen_answers')
      .update({ score: scored.score, ai_reasoning: scored.reasoning })
      .eq('screen_call_id', screenCall!.id)
      .eq('question_id', scored.questionId)
  }

  await adminDb
    .from('screen_calls')
    .update({ inflection_notes: batchResult.inflectionNotes })
    .eq('id', screenCall!.id)

  const passFailResult = runPassFailEngine(
    batchResult.scoredAnswers,
    { pass_threshold: questionSet.passThreshold, questions: questionSet.questions },
    batchResult.qualitativeSummary
  )

  await saveScreenResult({
    applicationId,
    passed: passFailResult.passed,
    failReason: passFailResult.failReason,
    qualitativeSummary: passFailResult.qualitativeSummary,
    managerBriefing: batchResult.managerBriefing,
    scoredAnswers: batchResult.scoredAnswers,
    totalScore: passFailResult.totalScore,
    thresholdAtTime: questionSet.passThreshold,
  })

  await updateApplicationStatus(applicationId, passFailResult.passed ? 'passed' : 'failed')

  return NextResponse.json({
    ok: true,
    passed: passFailResult.passed,
    totalScore: passFailResult.totalScore,
  })
}
