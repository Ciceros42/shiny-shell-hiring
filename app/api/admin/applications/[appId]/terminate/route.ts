import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: RouteContext) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { appId } = await params

  let query = adminDb
    .from('applications')
    .select('id, status')
    .eq('id', appId)
    .eq('company_id', profile.companyId)

  if (profile.role === 'location_manager' && profile.locationId) {
    query = query.eq('location_id', profile.locationId)
  }

  const { data: app } = await (query as typeof query).maybeSingle()

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.status !== 'hired' && app.status !== 'terminated') {
    return NextResponse.json({ error: 'Application must be hired or terminated to toggle' }, { status: 400 })
  }

  const newStatus = app.status === 'hired' ? 'terminated' : 'hired'
  const updates =
    newStatus === 'terminated'
      ? { status: 'terminated', terminated_at: new Date().toISOString() }
      : { status: 'hired', terminated_at: null }

  const { error: updateError } = await adminDb
    .from('applications')
    .update(updates)
    .eq('id', appId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, newStatus })
}
