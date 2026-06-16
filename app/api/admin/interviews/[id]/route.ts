import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await req.json()

  const allowed: Record<string, unknown> = {}
  if (typeof body.notes === 'string') allowed.notes = body.notes
  if (body.notes === null) allowed.notes = null
  if (typeof body.interviewer_score === 'number' && body.interviewer_score >= 1 && body.interviewer_score <= 5) {
    allowed.interviewer_score = body.interviewer_score
  }
  if (body.interviewer_score === null) allowed.interviewer_score = null

  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  // Verify the interview belongs to an application in this company
  const { data: interview } = await adminDb
    .from('interviews')
    .select('id, applications!inner(company_id)')
    .eq('id', id)
    .single()

  type InterviewRow = { id: string; applications: { company_id: string } | null }
  const iv = interview as unknown as InterviewRow | null
  if (!iv || (iv.applications?.company_id !== profile.companyId && profile.role !== 'dev')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error: dbError } = await adminDb
    .from('interviews')
    .update(allowed)
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
