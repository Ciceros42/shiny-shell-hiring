import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { appId } = await params

  let query = adminDb
    .from('applications')
    .update({ status: 'dismissed' })
    .eq('id', appId)
    .eq('company_id', profile.companyId)

  if (profile.role === 'location_manager' && profile.locationId) {
    query = query.eq('location_id', profile.locationId)
  }

  const { data, error: dbError } = await query.select('id')

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
