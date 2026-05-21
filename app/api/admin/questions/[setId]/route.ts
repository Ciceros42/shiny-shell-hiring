import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { z } from 'zod'

const PatchSchema = z.object({
  job_title: z.string().min(1).optional(),
  pass_threshold: z.number().int().min(0).max(100).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { setId } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { error: dbError } = await adminDb
    .from('question_sets')
    .update(parsed.data)
    .eq('id', setId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
