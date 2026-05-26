import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { user, error } = await requireAdmin()
  if (error) return error

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user!.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company found' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const jobTitle = typeof body.job_title === 'string' && body.job_title.trim()
    ? body.job_title.trim()
    : 'New Question Set'

  const { data, error: dbError } = await adminDb
    .from('question_sets')
    .insert({ job_title: jobTitle, company_id: profile.company_id, pass_threshold: 70 })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
