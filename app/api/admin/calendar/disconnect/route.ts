import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(_req: Request) {
  const { user, error } = await requireAdmin()
  if (error) return error

  await adminDb
    .from('profiles')
    .update({ calendar_token_encrypted: null, calendar_token_created_at: null })
    .eq('id', user!.id)

  return NextResponse.json({ ok: true })
}
