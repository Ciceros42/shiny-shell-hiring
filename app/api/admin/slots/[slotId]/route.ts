import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ slotId: string }> }

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { error } = await requireAdmin()
  if (error) return error

  const { slotId } = await params

  // Only delete if still available — booked slots must not be removed
  const { error: dbError, count } = await adminDb
    .from('interview_slots')
    .delete({ count: 'exact' })
    .eq('id', slotId)
    .eq('is_available', true)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (count === 0) return NextResponse.json({ error: 'Slot is booked or not found' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
