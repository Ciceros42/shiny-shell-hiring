import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { createRetentionCheckins } from '@/lib/db/retention'

type RouteContext = { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: RouteContext) {
  const { error } = await requireAdmin()
  if (error) return error

  const { appId } = await params

  // Verify application exists
  const { data: app } = await adminDb
    .from('applications')
    .select('id, status')
    .eq('id', appId)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (app.status === 'hired') return NextResponse.json({ ok: true, alreadyHired: true })

  // Mark hired
  const { error: updateError } = await adminDb
    .from('applications')
    .update({ status: 'hired' })
    .eq('id', appId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Create 30/60/90-day retention check-ins
  await createRetentionCheckins(appId)

  return NextResponse.json({ ok: true })
}
