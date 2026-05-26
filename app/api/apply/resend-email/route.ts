import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabase/admin'
import { sendScreenLinkEmail } from '@/lib/email/send'

export async function POST(req: Request) {
  const { applicationId, email } = await req.json().catch(() => ({}))

  if (!applicationId || !email) {
    return NextResponse.json({ error: 'Missing applicationId or email' }, { status: 400 })
  }

  const { data: app } = await adminDb
    .from('applications')
    .select('id, magic_links(token, expires_at, type), applicants(name), locations(name)')
    .eq('id', applicationId)
    .single()

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const links = app.magic_links as unknown as { token: string; expires_at: string; type: string }[]
  const link = links?.find((l) => l.type === 'screen' && new Date(l.expires_at) > new Date())

  if (!link) {
    return NextResponse.json({ error: 'Screen link has expired' }, { status: 410 })
  }

  const screenUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/screen/${link.token}`
  const applicant = app.applicants as unknown as { name: string } | null
  const location = app.locations as unknown as { name: string } | null

  await sendScreenLinkEmail({
    to: email,
    name: applicant?.name ?? 'there',
    screenUrl,
    locationName: location?.name ?? 'Shiny Shell',
  })

  return NextResponse.json({ ok: true })
}
