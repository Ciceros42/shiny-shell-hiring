import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  if (process.env.ENABLE_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { appId } = await req.json()
  if (!appId) {
    return NextResponse.json({ error: 'appId required' }, { status: 400 })
  }

  const { data, error } = await adminDb
    .from('applications')
    .update({ status: 'screen_complete' })
    .eq('id', appId)
    .select('id, status')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id: data.id, status: data.status })
}
