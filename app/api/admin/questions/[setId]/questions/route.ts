import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { z } from 'zod'

const QuestionSchema = z.object({
  type: z.enum(['hard_filter', 'scored', 'informational']),
  variants: z.array(z.string().min(1)).min(1).max(4),
  rubric: z.string().optional().nullable(),
  fail_value: z.string().optional().nullable(),
  weight: z.number().int().min(1).max(5).optional(),
  order_index: z.number().int().min(0),
})

export async function POST(req: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { profile, error } = await requireAdmin()
  if (error) return error

  const { setId } = await params

  const { data: set } = await adminDb
    .from('question_sets')
    .select('id')
    .eq('id', setId)
    .eq('company_id', profile.companyId)
    .single()
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = QuestionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 })

  const { data, error: dbError } = await adminDb
    .from('questions')
    .insert({
      question_set_id: setId,
      type: parsed.data.type,
      variants: parsed.data.variants,
      rubric: parsed.data.rubric ?? null,
      fail_value: parsed.data.fail_value ?? null,
      weight: parsed.data.weight ?? 1,
      order_index: parsed.data.order_index,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json(data)
}
