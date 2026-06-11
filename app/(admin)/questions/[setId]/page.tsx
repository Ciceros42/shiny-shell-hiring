import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/supabase/admin'
import QuestionSetEditor, { type QuestionRow } from '@/components/admin/questions/QuestionSetEditor'

export const revalidate = 0

type Params = { setId: string }

export default async function QuestionSetPage({ params }: { params: Promise<Params> }) {
  const { setId } = await params

  const { data: set } = await adminDb
    .from('question_sets')
    .select('id, job_title, pass_threshold, is_active')
    .eq('id', setId)
    .maybeSingle()

  if (!set) notFound()

  const { data: questions } = await adminDb
    .from('questions')
    .select('id, type, variants, rubric, fail_value, weight, order_index')
    .eq('question_set_id', setId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  return (
    <div className="p-8 max-w-3xl">
      <QuestionSetEditor
        setId={setId}
        initialJobTitle={set.job_title as string}
        initialThreshold={set.pass_threshold as number}
        initialQuestions={(questions ?? []) as unknown as QuestionRow[]}
      />
    </div>
  )
}
