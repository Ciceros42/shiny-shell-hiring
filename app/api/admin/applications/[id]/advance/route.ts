import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { advanceApplicant } from '@/lib/actions/advance-applicant'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  try {
    await advanceApplicant(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
