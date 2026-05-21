import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getOAuthUrl } from '@/lib/google-calendar/sync'

export async function GET() {
  const { user, error } = await requireAdmin()
  if (error) return error

  const url = getOAuthUrl(user!.id)
  return NextResponse.redirect(url)
}
