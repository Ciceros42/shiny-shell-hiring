import { adminDb } from '@/lib/supabase/admin'

export type FormOption = { text: string; is_fail: boolean }

export interface AppFormQuestion {
  id: string
  formId: string
  questionText: string
  questionType: 'single' | 'multi'
  isRequired: boolean
  orderIndex: number
  options: FormOption[]
}

export interface AppForm {
  id: string
  companyId: string
  name: string
  createdAt: string
  questions: AppFormQuestion[]
}

export async function listApplicationForms(companyId: string): Promise<AppForm[]> {
  const { data } = await adminDb
    .from('application_forms')
    .select('id, company_id, name, created_at, application_form_questions(id, question_text, question_type, is_required, order_index, options)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
  return (data ?? []).map(mapForm)
}

export async function getApplicationForm(formId: string, companyId: string): Promise<AppForm | null> {
  const { data } = await adminDb
    .from('application_forms')
    .select('id, company_id, name, created_at, application_form_questions(id, question_text, question_type, is_required, order_index, options)')
    .eq('id', formId)
    .eq('company_id', companyId)
    .maybeSingle()
  return data ? mapForm(data) : null
}

export async function getApplicationFormForJob(jobId: string): Promise<AppForm | null> {
  const { data: job } = await adminDb
    .from('jobs')
    .select('application_form_id')
    .eq('id', jobId)
    .maybeSingle()
  if (!job?.application_form_id) return null
  const { data } = await adminDb
    .from('application_forms')
    .select('id, company_id, name, created_at, application_form_questions(id, question_text, question_type, is_required, order_index, options)')
    .eq('id', job.application_form_id)
    .maybeSingle()
  return data ? mapForm(data) : null
}

export async function createApplicationForm(companyId: string, name: string): Promise<AppForm> {
  const { data, error } = await adminDb
    .from('application_forms')
    .insert({ company_id: companyId, name })
    .select('id, company_id, name, created_at')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create form')
  return { id: data.id, companyId: data.company_id, name: data.name, createdAt: data.created_at, questions: [] }
}

export async function updateApplicationFormName(formId: string, companyId: string, name: string): Promise<void> {
  await adminDb.from('application_forms').update({ name }).eq('id', formId).eq('company_id', companyId)
}

export async function deleteApplicationForm(formId: string, companyId: string): Promise<void> {
  await adminDb.from('application_forms').delete().eq('id', formId).eq('company_id', companyId)
}

export async function addQuestion(formId: string, q: {
  questionText: string
  questionType: 'single' | 'multi'
  isRequired: boolean
  options: FormOption[]
}): Promise<AppFormQuestion> {
  const { data: last } = await adminDb
    .from('application_form_questions')
    .select('order_index')
    .eq('form_id', formId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const orderIndex = (last?.order_index ?? -1) + 1
  const { data, error } = await adminDb
    .from('application_form_questions')
    .insert({ form_id: formId, question_text: q.questionText, question_type: q.questionType, is_required: q.isRequired, order_index: orderIndex, options: q.options })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to add question')
  return mapQuestion(data)
}

export async function updateQuestion(questionId: string, updates: {
  questionText?: string
  questionType?: 'single' | 'multi'
  isRequired?: boolean
  options?: FormOption[]
}): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.questionText !== undefined) row.question_text = updates.questionText
  if (updates.questionType !== undefined) row.question_type = updates.questionType
  if (updates.isRequired !== undefined) row.is_required = updates.isRequired
  if (updates.options !== undefined) row.options = updates.options
  await adminDb.from('application_form_questions').update(row).eq('id', questionId)
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await adminDb.from('application_form_questions').delete().eq('id', questionId)
}

export async function saveApplicationResponses(
  applicationId: string,
  responses: { questionId: string; selectedOptions: string[] }[]
): Promise<void> {
  if (responses.length === 0) return
  await adminDb.from('application_responses').insert(
    responses.map((r) => ({ application_id: applicationId, question_id: r.questionId, selected_options: r.selectedOptions }))
  )
}

export async function getApplicationResponses(applicationId: string): Promise<{
  questionText: string
  questionType: string
  selectedOptions: string[]
}[]> {
  const { data } = await adminDb
    .from('application_responses')
    .select('selected_options, application_form_questions(question_text, question_type, order_index)')
    .eq('application_id', applicationId)
  return (data ?? [])
    .map((r) => {
      const q = r.application_form_questions as unknown as { question_text: string; question_type: string; order_index: number } | null
      return { questionText: q?.question_text ?? '', questionType: q?.question_type ?? 'single', selectedOptions: r.selected_options as string[], orderIndex: q?.order_index ?? 0 }
    })
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapForm(row: any): AppForm {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    createdAt: row.created_at,
    questions: ((row.application_form_questions ?? []) as any[]).map(mapQuestion).sort((a: AppFormQuestion, b: AppFormQuestion) => a.orderIndex - b.orderIndex),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapQuestion(row: any): AppFormQuestion {
  return {
    id: row.id,
    formId: row.form_id,
    questionText: row.question_text,
    questionType: row.question_type,
    isRequired: row.is_required,
    orderIndex: row.order_index,
    options: (row.options ?? []) as FormOption[],
  }
}
