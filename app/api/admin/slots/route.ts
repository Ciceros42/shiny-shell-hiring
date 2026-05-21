import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const AddSlotSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  location_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const { user, error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const parsed = AddSlotSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Verify the location belongs to this user's company
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, location_id, role')
    .eq('id', user!.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const isOwnLocation =
    profile.role === 'company_admin' ||
    profile.location_id === parsed.data.location_id

  if (!isOwnLocation) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error: dbError } = await adminDb
    .from('interview_slots')
    .insert({
      location_id: parsed.data.location_id,
      manager_user_id: user!.id,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      is_available: true,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}
