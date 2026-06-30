import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  if (process.env.ENABLE_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { appId } = await req.json().catch(() => ({}))
  if (!appId) return NextResponse.json({ error: 'appId required' }, { status: 400 })

  // Transition application scheduled → interviewed
  const { data: app, error: appError } = await adminDb
    .from('applications')
    .update({ status: 'interviewed' })
    .eq('id', appId)
    .eq('status', 'scheduled')
    .select('id, status')
    .single()

  if (appError || !app) {
    return NextResponse.json(
      { error: appError?.message ?? 'Application not found or not in scheduled status' },
      { status: 404 }
    )
  }

  // Mark interview as completed
  await adminDb
    .from('interviews')
    .update({ status: 'completed' })
    .eq('application_id', appId)
    .eq('status', 'scheduled')

  return NextResponse.json({ ok: true, appId: app.id, status: app.status })
}
