import { adminDb } from '@/lib/supabase/admin'

export interface QuestionRow {
  id: string
  type: 'hard_filter' | 'scored' | 'informational'
  variants: string[]
  rubric: string | null
  fail_value: string | null
  weight: number
  order_index: number
}

export interface QuestionSet {
  id: string
  passThreshold: number
  questions: QuestionRow[]
}

export async function getQuestionSetWithQuestions(questionSetId: string): Promise<QuestionSet> {
  const { data, error } = await adminDb
    .from('question_sets')
    .select('id, pass_threshold, questions(*)')
    .eq('id', questionSetId)
    .single()

  if (error || !data) throw new Error(`getQuestionSetWithQuestions failed for ${questionSetId}`)

  const questions = ((data.questions as QuestionRow[]) ?? []).sort(
    (a, b) => a.order_index - b.order_index
  )

  return {
    id: data.id as string,
    passThreshold: data.pass_threshold as number,
    questions,
  }
}
