import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listLocations, createLocation } from '@/lib/db/locations'

export async function GET() {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const companyId = profile.companyId
  const locations = await listLocations(companyId)
  return NextResponse.json(locations)
}

export async function POST(req: Request) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, timezone, companyId } = await req.json()
  if (!name?.trim() || !timezone?.trim()) return NextResponse.json({ error: 'Name and timezone required' }, { status: 422 })
  const targetCompanyId = profile.role === 'dev' ? (companyId ?? profile.companyId) : profile.companyId
  const id = await createLocation(targetCompanyId, name.trim(), timezone.trim())
  return NextResponse.json({ id }, { status: 201 })
}
