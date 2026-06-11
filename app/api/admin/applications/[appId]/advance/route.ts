import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { advanceApplicant } from '@/lib/actions/advance-applicant'

interface Params { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { appId } = await params
  try {
    await advanceApplicant(appId, profile.companyId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
