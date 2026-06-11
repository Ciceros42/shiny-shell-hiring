import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rejectApplicant } from '@/lib/actions/advance-applicant'

interface Params { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  const { appId } = await params
  await rejectApplicant(appId, profile.companyId)
  return NextResponse.json({ ok: true })
}
