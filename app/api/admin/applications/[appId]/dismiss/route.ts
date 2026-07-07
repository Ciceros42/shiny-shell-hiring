import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { appId } = await params

  const { error: dbError } = await adminDb
    .from('applications')
    .update({ status: 'dismissed' })
    .eq('id', appId)
    .eq('company_id', profile.companyId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
