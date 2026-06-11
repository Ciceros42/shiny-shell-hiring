import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listAllCompanies, createCompany } from '@/lib/db/companies'

export async function GET() {
  const { profile, error } = await requireAdmin()
  if (error) return error
  if (profile.role !== 'dev') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const companies = await listAllCompanies()
  return NextResponse.json(companies)
}

export async function POST(req: Request) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  if (profile.role !== 'dev') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, displayName, brandColor } = await req.json()
  if (!name?.trim() || !displayName?.trim()) return NextResponse.json({ error: 'Name and display name required' }, { status: 422 })
  const id = await createCompany(name.trim(), displayName.trim(), brandColor?.trim() || '#1e3c6c')
  return NextResponse.json({ id }, { status: 201 })
}
