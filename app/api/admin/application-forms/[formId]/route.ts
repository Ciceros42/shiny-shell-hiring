import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getApplicationForm, updateApplicationFormName, deleteApplicationForm } from '@/lib/db/application-forms'

interface Params { params: Promise<{ formId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { formId } = await params
  const form = await getApplicationForm(formId, profile.companyId)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(form)
}

export async function PATCH(req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { formId } = await params
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 422 })
  await updateApplicationFormName(formId, profile.companyId, name.trim())
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { formId } = await params
  await deleteApplicationForm(formId, profile.companyId)
  return NextResponse.json({ ok: true })
}
