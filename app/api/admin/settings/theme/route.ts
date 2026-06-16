import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { invalidateCompany } from '@/lib/db/companies'

export async function PATCH(req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  if (typeof body.fontUrl === 'string') allowed.fontUrl = body.fontUrl.trim() || null
  if (body.fontUrl === null) allowed.fontUrl = null
  if (typeof body.fontFamily === 'string') allowed.fontFamily = body.fontFamily.trim() || null
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  const { data: company } = await adminDb
    .from('companies')
    .select('settings')
    .eq('id', profile.companyId)
    .single()

  const currentSettings = (company?.settings as Record<string, unknown>) ?? {}
  const currentTheme = (currentSettings.theme as Record<string, unknown>) ?? {}

  await adminDb
    .from('companies')
    .update({ settings: { ...currentSettings, theme: { ...currentTheme, ...allowed } } })
    .eq('id', profile.companyId)

  invalidateCompany(profile.companyId)
  return NextResponse.json({ ok: true })
}
