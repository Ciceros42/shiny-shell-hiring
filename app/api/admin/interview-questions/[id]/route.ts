import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  await adminDb.from('interview_questions').delete().eq('id', id).eq('company_id', profile.companyId)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  if (typeof body.text === 'string' && body.text.trim()) allowed.text = body.text.trim()
  if (typeof body.hint === 'string') allowed.hint = body.hint.trim() || null
  if (body.hint === null) allowed.hint = null
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })
  await adminDb.from('interview_questions').update(allowed).eq('id', id).eq('company_id', profile.companyId)
  return NextResponse.json({ ok: true })
}
