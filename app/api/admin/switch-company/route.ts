import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/auth/require-admin'

export async function POST(req: Request) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  if (profile.role !== 'dev') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { companyId } = await req.json()
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 422 })

  const cookieStore = await cookies()
  cookieStore.set('active_company_id', companyId, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })

  return NextResponse.json({ ok: true })
}
