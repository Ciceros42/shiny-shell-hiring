import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { BookSlotSchema } from '@/lib/validators/schedule'
import { getMagicLink, markMagicLinkUsed } from '@/lib/db/magic-links'
import { getApplicationById, updateApplicationStatus } from '@/lib/db/applications'
import { getApplicant, removeFromTalentPool } from '@/lib/db/applicants'
import { getLocationById } from '@/lib/db/locations'
import { getInterviewById, updateInterviewGoogleEventId } from '@/lib/db/interviews'
import { getScreenResult } from '@/lib/db/screen-results'
import { adminDb } from '@/lib/supabase/admin'
import { createInterviewEvent } from '@/lib/google/calendar'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { formatInterviewDateTime } from '@/lib/scheduling/slots'

interface Params {
  params: Promise<{ token: string }>
}

export async function POST(req: Request, { params }: Params) {
  const { token } = await params

  const magicLink = await getMagicLink(token)
  if (!magicLink || magicLink.type !== 'schedule') {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }
  if (magicLink.expiresAt && new Date(magicLink.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 })
  }
  if (magicLink.usedAt) {
    return NextResponse.json({ error: 'You already have an interview scheduled.' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BookSlotSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const { slotId } = parsed.data

  // Fix 12: book_slot RPC serializes with pg_advisory_xact_lock — race and double-booking safe
  const { data: interviewId, error: rpcError } = await adminDb.rpc('book_slot', {
    p_slot_id: slotId,
    p_application_id: magicLink.applicationId,
  })

  if (rpcError) {
    const code = (rpcError as { code?: string }).code
    if (code === 'P0011') {
      return NextResponse.json(
        { error: 'That slot was just taken — please pick another time.' },
        { status: 409 }
      )
    }
    if (code === 'P0010') {
      return NextResponse.json(
        { error: 'You already have an interview scheduled.' },
        { status: 409 }
      )
    }
    Sentry.captureException(rpcError)
    return NextResponse.json({ error: 'Booking failed. Please try again.' }, { status: 500 })
  }

  // Fix 13: post-booking sequence — order matters
  // Step 2
  await markMagicLinkUsed(magicLink.id)
  // Step 3
  await updateApplicationStatus(magicLink.applicationId, 'scheduled')

  const application = await getApplicationById(magicLink.applicationId)
  const applicant = await getApplicant(application.applicantId)
  const location = await getLocationById(application.locationId)

  // Step 4: remove from talent pool (was tagged passed_no_schedule)
  if (applicant) {
    await removeFromTalentPool(applicant.id, location.id)
  }

  // Step 5: Google Calendar — try/catch so booking succeeds even if calendar fails
  const interview = await getInterviewById(interviewId as string)
  const screenResult = await getScreenResult(magicLink.applicationId)

  if (interview) {
    const { data: slotRow } = await adminDb
      .from('interview_slots')
      .select('start_time, end_time')
      .eq('id', slotId)
      .single()

    try {
      const { googleEventId } = await createInterviewEvent({
        interviewId: interview.id,
        applicantName: applicant?.name ?? 'Applicant',
        slotStartTime: slotRow?.start_time ?? '',
        slotEndTime: slotRow?.end_time ?? '',
        locationName: location.name,
        locationAddress: null,
        managerBriefing: screenResult?.managerBriefing ?? null,
        managerUserId: '',
      })
      // Step 6
      await updateInterviewGoogleEventId(interview.id, googleEventId)
    } catch (err) {
      Sentry.captureException(err, { extra: { context: 'createInterviewEvent', interviewId: interview.id } })
    }

    // Step 7: confirmation SMS
    if (applicant && slotRow) {
      const dateStr = formatInterviewDateTime(slotRow.start_time, location.timezone)
      await sendSMS(
        applicant.phone,
        SMS.interviewConfirmation(dateStr, location.name),
        application.id,
        'interview_confirmation',
        location.timezone,
        { bypassQuietHours: true }
      )
    }
  }

  return NextResponse.json({ status: 'confirmed', interviewId })
}
