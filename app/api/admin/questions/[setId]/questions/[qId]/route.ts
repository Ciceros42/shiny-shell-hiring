import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { z } from 'zod'

const PatchSchema = z.object({
  type: z.enum(['hard_filter', 'scored', 'informational']).optional(),
  variants: z.array(z.string().min(1)).min(1).max(4).optional(),
  rubric: z.string().nullable().optional(),
  fail_value: z.string().nullable().optional(),
  weight: z.number().int().min(1).max(5).optional(),
  order_index: z.number().int().min(0).optional(),
})

type RouteContext = { params: Promise<{ setId: string; qId: string }> }

export async function PATCH(req: Request, { params }: RouteContext) {
  const { profile, error } = await requireAdmin()
  if (error) return error

  const { setId, qId } = await params

  const { data: set } = await adminDb
    .from('question_sets')
    .select('id')
    .eq('id', setId)
    .eq('company_id', profile.companyId)
    .single()
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { error: dbError } = await adminDb
    .from('questions')
    .update(parsed.data)
    .eq('id', qId)
    .eq('question_set_id', setId)
    .is('deleted_at', null)

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { profile, error } = await requireAdmin()
  if (error) return error

  const { setId, qId } = await params

  const { data: set } = await adminDb
    .from('question_sets')
    .select('id')
    .eq('id', setId)
    .eq('company_id', profile.companyId)
    .single()
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: dbError } = await adminDb
    .from('questions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', qId)
    .eq('question_set_id', setId)

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
