import { addDays, set, startOfDay } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { adminDb } from '@/lib/supabase/admin'
import { twilioClient } from './client'

export interface SendSMSOptions {
  bypassQuietHours?: boolean
}

// Quiet hours: 9pm – 8am in the recipient's timezone
function isQuietHours(timezone: string): boolean {
  const now = toZonedTime(new Date(), timezone)
  const hour = now.getHours()
  return hour >= 21 || hour < 8
}

async function logPendingSMS({
  to,
  body,
  applicationId,
  messageType,
  timezone,
}: {
  to: string
  body: string
  applicationId: string | null
  messageType: string
  timezone: string
}) {
  const zonedNow = toZonedTime(new Date(), timezone)
  const next8am = set(addDays(startOfDay(zonedNow), 1), { hours: 8 })
  const sendAfter = fromZonedTime(next8am, timezone).toISOString()

  await adminDb.from('pending_sms').insert({
    to_phone: to,
    body,
    application_id: applicationId,
    message_type: messageType,
    timezone,
    send_after: sendAfter,
  })
}

async function logSMSSent({
  applicationId,
  to,
  messageType,
  twilioSid,
}: {
  applicationId: string | null
  to: string
  messageType: string
  twilioSid: string
}) {
  await adminDb.from('sms_log').insert({
    application_id: applicationId,
    to_phone: to,
    message_type: messageType,
    direction: 'outbound',
    twilio_sid: twilioSid,
    status: 'queued',
  })
}

export async function sendSMS(
  to: string,
  body: string,
  applicationId: string | null,
  messageType: string,
  timezone: string,
  options: SendSMSOptions = {}
) {
  // Fix 18: TCPA opt-out check
  if (applicationId) {
    const { data: app } = await adminDb
      .from('applications')
      .select('applicant_id')
      .eq('id', applicationId)
      .single()

    if (app?.applicant_id) {
      const { data: applicant } = await adminDb
        .from('applicants')
        .select('sms_opted_out')
        .eq('id', app.applicant_id)
        .single()

      if (applicant?.sms_opted_out) return
    }
  }

  // Queue for after quiet hours if not bypassing
  if (!options.bypassQuietHours && isQuietHours(timezone)) {
    await logPendingSMS({ to, body, applicationId, messageType, timezone })
    return
  }

  const msg = await twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
    statusCallback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`,
  })

  await logSMSSent({ applicationId, to, messageType, twilioSid: msg.sid })
}
