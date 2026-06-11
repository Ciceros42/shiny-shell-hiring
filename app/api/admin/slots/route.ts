import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { z } from 'zod'

const AddSlotSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  location_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const { user, profile, error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const parsed = AddSlotSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // For location_manager, they may only add slots for their own location
  const isOwnLocation =
    profile.role === 'company_admin' ||
    profile.role === 'dev' ||
    profile.locationId === parsed.data.location_id
  if (!isOwnLocation) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify the location belongs to this company
  const { data: location } = await adminDb
    .from('locations')
    .select('id')
    .eq('id', parsed.data.location_id)
    .eq('company_id', profile.companyId)
    .single()
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error: dbError } = await adminDb
    .from('interview_slots')
    .insert({
      location_id: parsed.data.location_id,
      manager_user_id: user.id,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      is_available: true,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json(data)
}
