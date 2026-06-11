import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { updateQuestion, deleteQuestion } from '@/lib/db/application-forms'

interface Params { params: Promise<{ formId: string; questionId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { questionId } = await params
  const body = await req.json()
  await updateQuestion(questionId, {
    questionText: body.questionText,
    questionType: body.questionType,
    isRequired: body.isRequired,
    options: body.options,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { questionId } = await params
  await deleteQuestion(questionId)
  return NextResponse.json({ ok: true })
}
