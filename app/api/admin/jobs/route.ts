import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: Request) {
  const { error, user } = await requireAdmin()
  if (error) return error

  const { title, description, questionSetId } = await req.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 422 })
  }

  const { data: profile } = await adminDb
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company found for user' }, { status: 400 })
  }

  const baseSlug = slugify(title.trim())

  // Ensure slug uniqueness within company
  const { data: existing } = await adminDb
    .from('jobs')
    .select('slug')
    .eq('company_id', profile.company_id)
    .like('slug', `${baseSlug}%`)

  let slug = baseSlug
  const existingSlugs = new Set((existing ?? []).map((r) => r.slug))
  let i = 2
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${i++}`
  }

  const { data, error: insertError } = await adminDb
    .from('jobs')
    .insert({
      company_id: profile.company_id,
      title: title.trim(),
      slug,
      description: description?.trim() || null,
      question_set_id: questionSetId || null,
      is_active: true,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ job: data })
}
