import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { profile, error } = await requireAdmin()
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const jobTitle = typeof body.job_title === 'string' && body.job_title.trim()
    ? body.job_title.trim()
    : 'New Question Set'

  const { data, error: dbError } = await adminDb
    .from('question_sets')
    .insert({ job_title: jobTitle, company_id: profile.companyId, pass_threshold: 70 })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
