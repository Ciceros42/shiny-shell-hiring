import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

export async function GET() {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { data } = await adminDb
    .from('onboarding_templates')
    .select('id, text, order_index')
    .eq('company_id', profile.companyId)
    .order('order_index', { ascending: true })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Text required' }, { status: 422 })

  const { data: last } = await adminDb
    .from('onboarding_templates')
    .select('order_index')
    .eq('company_id', profile.companyId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((last?.order_index as number | null) ?? -1) + 1

  const { data, error: dbError } = await adminDb
    .from('onboarding_templates')
    .insert({ company_id: profile.companyId, text: text.trim(), order_index: nextOrder })
    .select('id, text, order_index')
    .single()

  if (dbError) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
