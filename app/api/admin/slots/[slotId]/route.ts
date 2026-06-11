import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ slotId: string }> }

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { profile, error } = await requireAdmin()
  if (error) return error

  const { slotId } = await params

  // Verify the slot's location belongs to this company
  const { data: slot } = await adminDb
    .from('interview_slots')
    .select('id, location_id, locations!inner(company_id)')
    .eq('id', slotId)
    .eq('locations.company_id', profile.companyId)
    .single()
  if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only delete if still available — booked slots must not be removed
  const { error: dbError, count } = await adminDb
    .from('interview_slots')
    .delete({ count: 'exact' })
    .eq('id', slotId)
    .eq('is_available', true)

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  if (count === 0) return NextResponse.json({ error: 'Slot is booked or not found' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
