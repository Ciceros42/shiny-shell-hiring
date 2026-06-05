import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rejectApplicant } from '@/lib/actions/advance-applicant'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  await rejectApplicant(id)
  return NextResponse.json({ ok: true })
}
