import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await req.json()

  const allowed: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') allowed.is_active = body.is_active
  if (typeof body.title === 'string') allowed.title = body.title.trim()
  if (typeof body.description === 'string') allowed.description = body.description.trim() || null
  if ('question_set_id' in body) allowed.question_set_id = body.question_set_id || null

  const { error: updateError } = await adminDb
    .from('jobs')
    .update(allowed)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
