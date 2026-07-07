import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

const ACTIVE_STATUSES = [
  'applied', 'sms_sent', 'screen_link_clicked', 'screening',
  'screen_complete', 'passed', 'scheduled', 'interviewed',
]

export async function POST(_req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { error: dbError } = await adminDb
    .from('applications')
    .update({ status: 'dismissed' })
    .eq('company_id', profile.companyId)
    .in('status', ACTIVE_STATUSES)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
