import OpenAI from 'openai'
import { adminDb } from '@/lib/supabase/admin'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export interface ScoredAnswer {
  questionId: string
  answerText: string
  score: number
  reasoning: string
  questionType: 'hard_filter' | 'scored' | 'informational'
  weight: number
}

export interface BatchScoringResult {
  scoredAnswers: ScoredAnswer[]
  inflectionNotes: string
  qualitativeSummary: string
  managerBriefing: string
}

export interface PassFailResult {
  passed: boolean
  failReason: string | null
  qualitativeSummary: string
  totalScore: number
}

interface ScreenAnswer {
  questionId: string
  answerText: string
}

interface Question {
  id: string
  type: 'hard_filter' | 'scored' | 'informational'
  order_index: number
  rubric?: string | null
  fail_value?: string | null
  weight?: number | null
  variants?: string[] | null
}

interface QuestionSet {
  pass_threshold: number
  questions: Question[]
}

async function getScreenAnswers(screenCallId: string): Promise<ScreenAnswer[]> {
  const { data } = await adminDb
    .from('screen_answers')
    .select('question_id, answer_text')
    .eq('screen_call_id', screenCallId)

  return (data ?? []).map((r) => ({ questionId: r.question_id, answerText: r.answer_text }))
}

async function upsertScreenAnswer({
  screenCallId,
  questionId,
  answerText,
}: {
  screenCallId: string
  questionId: string
  answerText: string
}) {
  await adminDb.from('screen_answers').upsert(
    { screen_call_id: screenCallId, question_id: questionId, answer_text: answerText },
    { onConflict: 'screen_call_id,question_id' }
  )
}

async function saveScreenAnswers(scoredAnswers: ScoredAnswer[]) {
  for (const a of scoredAnswers) {
    await adminDb
      .from('screen_answers')
      .update({ score: a.score, reasoning: a.reasoning })
      .eq('question_id', a.questionId)
  }
}

export async function batchScoreAndSummarize(
  answers: ScreenAnswer[],
  questions: Question[]
): Promise<BatchScoringResult> {
  const scoredQuestions = answers
    .map((a) => {
      const q = questions.find((q) => q.id === a.questionId)
      if (!q || q.type !== 'scored') return null
      return { ...a, question: q }
    })
    .filter(Boolean) as Array<ScreenAnswer & { question: Question }>

  if (scoredQuestions.length === 0) {
    return {
      scoredAnswers: [],
      inflectionNotes: '',
      qualitativeSummary: '',
      managerBriefing: '',
    }
  }

  const DEFAULT_RUBRIC = 'Score based on the specificity, relevance, and enthusiasm of the answer. A vague or one-word answer scores low (0–40). A clear, specific answer scores mid (40–75). A detailed, enthusiastic, well-reasoned answer scores high (75–100).'

  const prompt = `You are evaluating a job applicant for an entry-level carwash position. Be a fair but realistic grader — most applicants should score in the 40–75 range. Reserve 85+ for genuinely strong, specific answers and give below 40 for vague or dismissive ones.

For each answer below, score it 0-100 against its rubric.
Also provide inflection_notes (2 sentences: energy, engagement, confidence).
Also provide qualitative_summary (1-2 sentences: overall fit).
Also provide manager_briefing (max 60 words): "Strengths: [2 items]. Concern: [1 item]. Suggested question: [one specific follow-up grounded in what the applicant actually said]"

Questions and answers:
${scoredQuestions.map((a, i) => `[${i + 1}] Rubric: "${a.question.rubric ?? DEFAULT_RUBRIC}"\n       Answer: "${a.answerText}"`).join('\n\n')}

Respond as JSON only:
{
  "scores": [{ "index": 1, "score": 80, "reasoning": "..." }, ...],
  "inflection_notes": "...",
  "qualitative_summary": "...",
  "manager_briefing": "Strengths: ... Concern: ... Suggested question: ..."
}`

  const callOpenAI = async (extraInstruction = '') => {
    const content = extraInstruction ? prompt + `\n\n${extraInstruction}` : prompt
    return getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    })
  }

  let parsed: {
    scores: Array<{ index: number; score: number; reasoning: string }>
    inflection_notes: string
    qualitative_summary: string
    manager_briefing: string
  }

  try {
    const response = await callOpenAI()
    parsed = JSON.parse(response.choices[0].message.content!)
  } catch {
    const retry = await callOpenAI('IMPORTANT: Return valid JSON only.')
    parsed = JSON.parse(retry.choices[0].message.content!)
  }

  const scoredAnswers: ScoredAnswer[] = scoredQuestions.map((a, i) => {
    const scored = parsed.scores.find((s) => s.index === i + 1)
    return {
      questionId: a.questionId,
      answerText: a.answerText,
      score: scored?.score ?? 0,
      reasoning: scored?.reasoning ?? '',
      questionType: a.question.type,
      weight: a.question.weight ?? 1,
    }
  })

  return {
    scoredAnswers,
    inflectionNotes: parsed.inflection_notes ?? '',
    qualitativeSummary: parsed.qualitative_summary ?? '',
    managerBriefing: parsed.manager_briefing ?? '',
  }
}

export function runPassFailEngine(
  scoredAnswers: ScoredAnswer[],
  questionSet: QuestionSet,
  qualitativeSummary: string
): PassFailResult {
  const questions = questionSet.questions

  // Hard filters first — immediate fail on mismatch
  for (const answer of scoredAnswers) {
    const q = questions.find((q) => q.id === answer.questionId)
    if (!q || q.type !== 'hard_filter') continue
    if (
      q.fail_value &&
      answer.answerText.trim().toLowerCase() === q.fail_value.trim().toLowerCase()
    ) {
      return {
        passed: false,
        failReason: `hard_filter:${answer.questionId}`,
        qualitativeSummary,
        totalScore: 0,
      }
    }
  }

  // Weighted score across scored questions
  const scored = scoredAnswers.filter((a) => a.questionType === 'scored')
  if (scored.length === 0) {
    // No scored answers means the call ended before questions were answered — do not auto-pass
    return { passed: false, failReason: 'no_scored_answers', qualitativeSummary, totalScore: 0 }
  }

  const totalWeight = scored.reduce((sum, a) => sum + a.weight, 0)
  const weightedScore =
    totalWeight > 0
      ? scored.reduce((sum, a) => sum + (a.score * a.weight) / totalWeight, 0)
      : 0

  const passed = weightedScore >= questionSet.pass_threshold

  return {
    passed,
    failReason: passed ? null : `score_below_threshold:${Math.round(weightedScore)}`,
    qualitativeSummary,
    totalScore: Math.round(weightedScore),
  }
}

export async function reconcileAnswersFromTranscript(
  screenCallId: string,
  questions: Question[],
  transcript: string
) {
  const existing = await getScreenAnswers(screenCallId)
  const answeredIds = new Set(existing.map((a) => a.questionId))
  const missing = questions.filter((q) => !answeredIds.has(q.id) && q.type !== 'informational')

  if (missing.length === 0) return

  const prompt = `Extract the applicant's answers to the following questions from this call transcript.
Only include answers that are clearly stated by the applicant. If an answer is not present, omit it.

Transcript:
${transcript}

Questions:
${missing.map((q, i) => `[${i + 1}] Question: "${Array.isArray(q.variants) && q.variants[0] ? q.variants[0] : 'Q' + (i+1)}" (ID: ${q.id})`).join('\n')}

Respond as JSON only:
{
  "answers": [{ "questionId": "...", "answerText": "..." }, ...]
}`

  let parsed: { answers: Array<{ questionId: string; answerText: string }> }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    parsed = JSON.parse(response.choices[0].message.content!)
  } catch {
    // Anti-hallucination: on parse failure, skip reconcile — do NOT insert guesses
    return
  }

  for (const extracted of parsed.answers ?? []) {
    if (!extracted.answerText) continue

    // Anti-hallucination guard: keyword overlap check (short answers like "Yes" are low risk — allowed through below)
    if (extracted.answerText.trim().length === 0) continue

    const STOP_WORDS = new Set(['i','a','the','and','to','of','is','it','was','my','we','you','that','this','for','in','on','at','be','are','have','do','not','but','so','just','like','really','very','get','got'])
    const keywords = extracted.answerText.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)).slice(0, 8)
    const transcriptLower = transcript.toLowerCase()
    const matchCount = keywords.filter(kw => transcriptLower.includes(kw)).length
    if (matchCount < 2 && keywords.length >= 2) continue  // likely hallucinated
    // if fewer than 2 keywords to check, allow it (very short answer — low hallucination risk)

    await upsertScreenAnswer({
      screenCallId,
      questionId: extracted.questionId,
      answerText: extracted.answerText,
    })
  }
}
