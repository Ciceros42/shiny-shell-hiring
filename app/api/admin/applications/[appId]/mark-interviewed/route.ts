import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { updateApplicationStatus } from '@/lib/db/applications'

interface Params { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { appId } = await params

  const { data: app } = await adminDb
    .from('applications')
    .select('id, status')
    .eq('id', appId)
    .eq('company_id', profile.companyId)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.status !== 'scheduled') return NextResponse.json({ error: 'Invalid status' }, { status: 422 })

  await updateApplicationStatus(appId, 'interviewed')

  // Mark the interview as completed
  await adminDb
    .from('interviews')
    .update({ status: 'completed' })
    .eq('application_id', appId)
    .eq('status', 'scheduled')

  return NextResponse.json({ ok: true })
}
