import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { updateLocation } from '@/lib/db/locations'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const fields: { name?: string; timezone?: string; isHiring?: boolean } = {}
  if (typeof body.name === 'string' && body.name.trim()) fields.name = body.name.trim()
  if (typeof body.timezone === 'string' && body.timezone.trim()) fields.timezone = body.timezone.trim()
  if (typeof body.isHiring === 'boolean') fields.isHiring = body.isHiring

  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  try {
    await updateLocation(id, profile.companyId, fields)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
