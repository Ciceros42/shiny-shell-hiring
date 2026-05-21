import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  is_hiring: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ locationId: string }> }

export async function PATCH(req: Request, { params }: RouteContext) {
  const { user, error } = await requireAdmin()
  if (error) return error

  const { locationId } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Verify user owns or manages this location
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, location_id')
    .eq('id', user!.id)
    .single()

  const allowed =
    profile?.role === 'company_admin' || profile?.location_id === locationId
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error: dbError } = await adminDb
    .from('locations')
    .update(parsed.data)
    .eq('id', locationId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
