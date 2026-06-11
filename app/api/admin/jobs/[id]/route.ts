import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { setJobLocations } from '@/lib/db/jobs'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await req.json()

  const allowed: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') allowed.is_active = body.is_active
  if (typeof body.title === 'string') allowed.title = body.title.trim()
  if (typeof body.description === 'string') allowed.description = body.description.trim() || null
  if ('question_set_id' in body) allowed.question_set_id = body.question_set_id || null
  if ('application_form_id' in body) allowed.application_form_id = body.application_form_id || null

  if (Object.keys(allowed).length > 0) {
    const { data: updated, error: updateError } = await adminDb
      .from('jobs')
      .update(allowed)
      .eq('id', id)
      .eq('company_id', profile.companyId)
      .select('id')

    if (updateError) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // Update location assignments if provided
  if (Array.isArray(body.location_ids)) {
    // Verify this job belongs to the company first
    const { data: job } = await adminDb
      .from('jobs')
      .select('id')
      .eq('id', id)
      .eq('company_id', profile.companyId)
      .maybeSingle()
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await setJobLocations(id, body.location_ids as string[])
  }

  return NextResponse.json({ ok: true })
}
