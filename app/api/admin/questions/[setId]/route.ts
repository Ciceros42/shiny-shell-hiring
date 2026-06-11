import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { z } from 'zod'

const PatchSchema = z.object({
  job_title: z.string().min(1).optional(),
  pass_threshold: z.number().int().min(0).max(100).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ setId: string }> }) {
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
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { error: dbError } = await adminDb
    .from('question_sets')
    .update(parsed.data)
    .eq('id', setId)
    .eq('company_id', profile.companyId)

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
