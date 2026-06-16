import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ userId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { error, profile, user } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params

  if (userId === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 422 })

  // Verify the target user belongs to this company
  const { data: targetProfile } = await adminDb
    .from('profiles')
    .select('id, company_id')
    .eq('id', userId)
    .maybeSingle()

  if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (targetProfile.company_id !== profile.companyId && profile.role !== 'dev') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete profile first (FK constraint), then auth user
  await adminDb.from('profiles').delete().eq('id', userId)
  await adminDb.auth.admin.deleteUser(userId)

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const body = await req.json()

  // Verify target belongs to this company
  const { data: targetProfile } = await adminDb
    .from('profiles')
    .select('id, company_id')
    .eq('id', userId)
    .maybeSingle()

  if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (targetProfile.company_id !== profile.companyId && profile.role !== 'dev') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const allowed: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) allowed.name = body.name.trim()
  if (['company_admin', 'location_manager'].includes(body.role)) allowed.role = body.role
  if (body.locationId !== undefined) allowed.location_id = body.locationId ?? null

  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  const { error: dbError } = await adminDb.from('profiles').update(allowed).eq('id', userId)
  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
