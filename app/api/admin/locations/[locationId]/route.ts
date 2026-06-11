import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { z } from 'zod'

const PatchSchema = z.object({
  is_hiring: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ locationId: string }> }

export async function PATCH(req: Request, { params }: RouteContext) {
  const { profile, error } = await requireAdmin()
  if (error) return error

  const { locationId } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // location_manager may only manage their own location
  const isOwnLocation =
    profile.role === 'dev' || profile.role === 'company_admin' || profile.locationId === locationId
  if (!isOwnLocation) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error: dbError } = await adminDb
    .from('locations')
    .update(parsed.data)
    .eq('id', locationId)
    .eq('company_id', profile.companyId)

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
