import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const { completed } = await req.json()
  if (typeof completed !== 'boolean') return NextResponse.json({ error: 'completed required' }, { status: 422 })

  // Verify the item belongs to an application in this company
  const { data: item } = await adminDb
    .from('onboarding_items')
    .select('id, applications!inner(company_id)')
    .eq('id', id)
    .maybeSingle()

  type ItemRow = { id: string; applications: { company_id: string } | null }
  const it = item as unknown as ItemRow | null
  if (!it || (it.applications?.company_id !== profile.companyId && profile.role !== 'dev')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await adminDb.from('onboarding_items').update({
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  }).eq('id', id)

  return NextResponse.json({ ok: true })
}
