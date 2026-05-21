import { NextResponse } from 'next/server'
import { getMagicLink } from '@/lib/db/magic-links'
import { getApplicationById } from '@/lib/db/applications'
import { getLocationById } from '@/lib/db/locations'
import { adminDb } from '@/lib/supabase/admin'
import { formatSlotsForDisplay } from '@/lib/scheduling/slots'

interface Params {
  params: Promise<{ token: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params

  const magicLink = await getMagicLink(token)
  if (!magicLink || magicLink.type !== 'schedule') {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }
  if (magicLink.expiresAt && new Date(magicLink.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }
  if (magicLink.usedAt) {
    return NextResponse.json({ error: 'already-booked' }, { status: 409 })
  }

  const application = await getApplicationById(magicLink.applicationId)
  const location = await getLocationById(application.locationId)

  // earliest_bookable enforces the 30-min gap after call ends (scoring must finish first)
  const after = magicLink.earliestBookable
    ? new Date(Math.max(new Date(magicLink.earliestBookable).getTime(), Date.now()))
    : new Date()

  const { data: slots } = await adminDb
    .from('interview_slots')
    .select('id, start_time, end_time')
    .eq('location_id', location.id)
    .eq('is_available', true)
    .gte('start_time', after.toISOString())
    .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('start_time', { ascending: true })
    .limit(30)

  const formatted = formatSlotsForDisplay(slots ?? [], location.timezone)

  return NextResponse.json({ slots: formatted, timezone: location.timezone })
}
