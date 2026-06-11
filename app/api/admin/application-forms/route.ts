import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listApplicationForms, createApplicationForm } from '@/lib/db/application-forms'

export async function GET() {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const forms = await listApplicationForms(profile.companyId)
  return NextResponse.json(forms)
}

export async function POST(req: Request) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 422 })
  const form = await createApplicationForm(profile.companyId, name.trim())
  return NextResponse.json(form, { status: 201 })
}
