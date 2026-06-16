import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { invalidateCompany } from '@/lib/db/companies'

export async function POST(req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { mode } = await req.json()
  if (mode !== 'suggestion' && mode !== 'assistant') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 422 })
  }

  if (!profile?.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const { data: company } = await adminDb.from('companies').select('settings').eq('id', profile.companyId).single()

  await adminDb.from('companies').update({
    settings: { ...(company?.settings as object ?? {}), pipeline_mode: mode }
  }).eq('id', profile.companyId)

  invalidateCompany(profile.companyId)
  return NextResponse.json({ ok: true })
}
