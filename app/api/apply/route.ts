import { NextResponse } from 'next/server'
import { parsePhoneNumber } from 'libphonenumber-js'
import * as Sentry from '@sentry/nextjs'
import { ApplySchema } from '@/lib/validators/apply'
import { isRateLimited } from '@/lib/ratelimit'
import { upsertApplicant, addToTalentPool } from '@/lib/db/applicants'
import { createApplication, updateApplicationStatus } from '@/lib/db/applications'
import { createMagicLink } from '@/lib/db/magic-links'
import { getLocationBySlug } from '@/lib/db/locations'
import { getJobBySlug } from '@/lib/db/jobs'
import { getUrgentShiftLabel } from '@/lib/db/slots'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { getTwilioClient as twilioClient } from '@/lib/twilio/client'
import { sendScreenLinkEmail } from '@/lib/email/send'
import { getApplicationFormForJob, saveApplicationResponses } from '@/lib/db/application-forms'
import { getCompanyConfig } from '@/lib/db/companies'
import { adminDb } from '@/lib/supabase/admin'
import { makeStatusToken } from '@/lib/auth/status-token'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ApplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, phone, email, companySlug, locationSlug, jobSlug, preferEmail, website, responses, source, availability } = parsed.data

  // Honeypot — silently accept to avoid tipping off bots
  if (website) return NextResponse.json({ status: 'ok' })

  let normalizedPhone: string
  try {
    normalizedPhone = parsePhoneNumber(phone, 'US').format('E.164')
  } catch {
    return NextResponse.json(
      { error: 'Please enter a valid US phone number.' },
      { status: 422 }
    )
  }

  // Feature G: Twilio Lookup — reject landlines, log non-fixed VoIP
  if (process.env.TWILIO_LOOKUP_ENABLED === 'true') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lookup: any = await twilioClient().lookups.v2
        .phoneNumbers(normalizedPhone)
        .fetch({ fields: 'line_type_intelligence' } as never)
      const lineType: string | undefined = lookup?.lineTypeIntelligence?.type

      if (lineType === 'landline') {
        return NextResponse.json(
          { error: 'Please enter a mobile phone number — we will call you for your interview.' },
          { status: 422 }
        )
      }
      if (lineType === 'nonFixedVoip') {
        Sentry.captureMessage(`nonFixedVoip phone on apply: ${normalizedPhone}`, 'warning')
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { context: 'twilio_lookup', phone: normalizedPhone } })
    }
  }

  let location
  try {
    location = await getLocationBySlug(locationSlug, companySlug)
  } catch {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  if (!location.isHiring) {
    return NextResponse.json({ error: 'This location is not currently hiring' }, { status: 503 })
  }

  // Look up the job
  let job
  try {
    job = await getJobBySlug(location.companyId, jobSlug)
  } catch {
    return NextResponse.json({ error: 'Position not found' }, { status: 404 })
  }

  if (!job.isActive) {
    return NextResponse.json({ error: 'This position is no longer accepting applications' }, { status: 503 })
  }

  if (!job.questionSetId) {
    return NextResponse.json({ error: 'This position is not yet configured for applications' }, { status: 503 })
  }

  const { displayName: companyName } = await getCompanyConfig(location.companyId)
  const smsOptedOut = !!(preferEmail && email)
  const applicant = await upsertApplicant({
    phone: normalizedPhone,
    email: email || undefined,
    name,
    smsOptedOut,
  })

  if (!location.isHiring) {
    await addToTalentPool(applicant.id, location.id, 'future_opening')
    await sendSMS(
      normalizedPhone,
      SMS.fullyStaffed(companyName),
      null,
      'fully_staffed',
      location.timezone,
      { bypassQuietHours: true }
    )
    return NextResponse.json({ status: 'queued' })
  }

  const application = await createApplication({
    applicantId: applicant.id,
    companyId: location.companyId,
    locationId: location.id,
    jobId: job.id,
    questionSetId: job.questionSetId,
    status: 'applied',
    source: source ?? 'direct',
    availability,
  })

  // Save application form responses and check for hard-fail answers
  if (responses && Object.keys(responses).length > 0) {
    const appForm = await getApplicationFormForJob(job.id)
    if (appForm) {
      const responseEntries = Object.entries(responses).map(([questionId, selectedOptions]) => ({ questionId, selectedOptions }))
      await saveApplicationResponses(application.id, responseEntries)

      // Check hard-fail: single-choice questions where selected option has is_fail=true
      let hardFailed = false
      for (const question of appForm.questions) {
        if (question.questionType !== 'single') continue
        const selected = responses[question.id]?.[0]
        if (!selected) continue
        const opt = question.options.find((o) => o.text === selected)
        if (opt?.is_fail) { hardFailed = true; break }
      }

      if (hardFailed) {
        await updateApplicationStatus(application.id, 'rejected')
        await addToTalentPool(applicant.id, location.id, 'failed_screen')
        // Queue rejection SMS 24 hours later so the cause isn't obvious
        const sendAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await adminDb.from('pending_sms').insert({
          to_phone: normalizedPhone,
          body: SMS.fail(companyName),
          application_id: application.id,
          message_type: 'rejection',
          timezone: location.timezone,
          send_after: sendAfter,
        })
        return NextResponse.json({ status: 'ok', applicationId: application.id, email: email || null, locationSlug, jobSlug })
      }
    }
  }

  const token = crypto.getRandomValues(new Uint8Array(32))
  const tokenStr = Buffer.from(token).toString('base64url')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await createMagicLink({
    type: 'screen',
    applicationId: application.id,
    token: tokenStr,
    expiresAt,
  })

  const urgentShift = await getUrgentShiftLabel(location.id)
  const screenUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/screen/${tokenStr}`
  const statusUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/status/${application.id}?t=${makeStatusToken(application.id)}`

  if (smsOptedOut && email) {
    await sendScreenLinkEmail({ to: email, name, screenUrl, locationName: location.name, companyName })
  } else {
    await sendSMS(
      normalizedPhone,
      SMS.screenLink(name, screenUrl, urgentShift, companyName, statusUrl),
      application.id,
      'screen_link',
      location.timezone,
      { bypassQuietHours: true }
    )
  }

  await updateApplicationStatus(application.id, 'sms_sent')

  return NextResponse.json({
    status: 'ok',
    applicationId: application.id,
    email: email || null,
    locationSlug,
    jobSlug,
  })
}
