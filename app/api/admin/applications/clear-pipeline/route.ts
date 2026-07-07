import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { ACTIVE_PIPELINE_STATUSES } from '@/lib/application-statuses'

export async function POST(_req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  let query = adminDb
    .from('applications')
    .update({ status: 'dismissed' })
    .eq('company_id', profile.companyId)
    .in('status', ACTIVE_PIPELINE_STATUSES)

  if (profile.role === 'location_manager' && profile.locationId) {
    query = query.eq('location_id', profile.locationId)
  }

  const { data, error: dbError } = await query.select('id')

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true, cleared: data?.length ?? 0 })
}
