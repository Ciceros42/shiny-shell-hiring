import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { addQuestion } from '@/lib/db/application-forms'

interface Params { params: Promise<{ formId: string }> }

export async function POST(req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { formId } = await params
  const body = await req.json()
  const { questionText, questionType, isRequired, options } = body
  if (!questionText?.trim()) return NextResponse.json({ error: 'Question text required' }, { status: 422 })
  if (!['single', 'multi'].includes(questionType)) return NextResponse.json({ error: 'Invalid type' }, { status: 422 })
  if (!Array.isArray(options) || options.length < 2) return NextResponse.json({ error: 'At least 2 options required' }, { status: 422 })
  const question = await addQuestion(formId, { questionText: questionText.trim(), questionType, isRequired: !!isRequired, options })
  return NextResponse.json(question, { status: 201 })
}
