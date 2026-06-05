import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { error, user } = await requireAdmin()
  if (error) return error

  const { mode } = await req.json()
  if (mode !== 'suggestion' && mode !== 'assistant') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 422 })
  }

  const { data: profile } = await adminDb.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const { data: company } = await adminDb.from('companies').select('settings').eq('id', profile.company_id).single()

  await adminDb.from('companies').update({
    settings: { ...(company?.settings as object ?? {}), pipeline_mode: mode }
  }).eq('id', profile.company_id)

  return NextResponse.json({ ok: true })
}
