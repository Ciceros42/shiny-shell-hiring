import twilio from 'twilio'
import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/supabase/admin'
import { getTwilioClient as twilioClient } from '@/lib/twilio/client'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { createRescheduleMagicLink } from '@/lib/db/magic-links'
import { markInterviewRescheduled, updateInterviewManagerRating, getScheduledInterviewByApplicationId } from '@/lib/db/interviews'
import { recordRetentionResponse } from '@/lib/db/retention'
import { updateApplicationStatus } from '@/lib/db/applications'
import { makeStatusToken } from '@/lib/auth/status-token'

const STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']

function twimlResponse(msg: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

function twimlEmpty(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const params = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v.toString()])
  )

  // Validate Twilio signature
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    req.url,
    params
  )
  if (!isValid) {
    Sentry.captureMessage('Twilio webhook signature validation failed', {
      extra: { url: req.url },
    })
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (params.Body ?? '').trim().toUpperCase()
  const from = params.From ?? ''
  const to = params.To ?? ''

  // Log inbound SMS — best-effort, non-critical
  try {
    await adminDb.from('sms_log').insert({
      to_phone: to,
      application_id: null,
      message_type: 'inbound',
      direction: 'inbound',
      twilio_sid: params.MessageSid ?? null,
      status: 'received',
    })
  } catch { /* non-critical */ }

  // Fix 18 / Feature B: TCPA opt-out keywords
  if (STOP_KEYWORDS.includes(body)) {
    await adminDb.from('applicants').update({ sms_opted_out: true }).eq('phone', from)
    return twimlResponse('You have been unsubscribed from Shiny Shell hiring messages. Reply START to resubscribe.')
  }

  if (body === 'START') {
    await adminDb.from('applicants').update({ sms_opted_out: false }).eq('phone', from)
    return twimlResponse('You have been resubscribed to Shiny Shell hiring messages.')
  }

  if (body === 'HELP') {
    return twimlResponse('Shiny Shell Hiring. Reply STOP to unsubscribe. Questions? Contact your local Shiny Shell location.')
  }

  if (body === 'STATUS') {
    const { data: app } = await adminDb
      .from('applications')
      .select('id, status, applicants!inner(phone)')
      .eq('applicants.phone', from)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!app) return twimlResponse('No active application found for this number.')
    const statusLabel = app.status.replace(/_/g, ' ')
    const statusUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/status/${app.id}?t=${makeStatusToken(app.id)}`
    return twimlResponse(`Your application status: ${statusLabel}. View details: ${statusUrl}`)
  }

  // R = reschedule request
  if (body === 'R') {
    try {
      // Find the applicant's most recent scheduled interview
      const { data: applicant } = await adminDb
        .from('applicants')
        .select('id')
        .eq('phone', from)
        .maybeSingle()

      if (!applicant) return twimlEmpty()

      const { data: app } = await adminDb
        .from('applications')
        .select('id, location_id, locations(timezone)')
        .eq('applicant_id', applicant.id)
        .eq('status', 'scheduled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!app) {
        return twimlResponse("We don't see a scheduled interview for your number. Please contact us directly.")
      }

      const interview = await getScheduledInterviewByApplicationId(app.id)
      if (!interview) return twimlEmpty()

      await markInterviewRescheduled(interview.id)
      await updateApplicationStatus(app.id, 'passed')

      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

      await createRescheduleMagicLink({
        applicationId: app.id,
        token,
        expiresAt,
        replacesInterviewId: interview.id,
      })

      const rescheduleUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/schedule/${token}`
      const timezone = (app.locations as { timezone?: string } | null)?.timezone ?? 'America/Denver'

      await sendSMS(from, SMS.rescheduleLink(rescheduleUrl), app.id, 'reschedule_link', timezone, {
        bypassQuietHours: true,
      })
    } catch (err) {
      Sentry.captureException(err, { extra: { context: 'reschedule_sms', from } })
    }
    return twimlEmpty()
  }

  // YES / NO = retention check-in response
  if (body === 'YES' || body === 'NO') {
    try {
      const { data: applicant } = await adminDb
        .from('applicants')
        .select('id')
        .eq('phone', from)
        .maybeSingle()

      if (applicant) {
        const { data: app } = await adminDb
          .from('applications')
          .select('id')
          .eq('applicant_id', applicant.id)
          .eq('status', 'hired')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (app) {
          await recordRetentionResponse(app.id, body === 'YES')
        }
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { context: 'retention_response', from } })
    }
    return twimlEmpty()
  }

  // GOOD / OK / NO = manager fit rating after interview
  if (body === 'GOOD' || body === 'OK' || body === 'NO') {
    try {
      // Look up manager by phone via profiles
      const { data: profile } = await adminDb
        .from('profiles')
        .select('id, location_id')
        .eq('phone', from)
        .maybeSingle()

      if (profile) {
        // Find the most recent interview at their location awaiting a rating
        const { data: interview } = await adminDb
          .from('interviews')
          .select('id, applications!inner(location_id)')
          .eq('applications.location_id', profile.location_id)
          .eq('fit_prompt_sent', true)
          .is('manager_rating', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (interview) {
          const ratingMap: Record<string, 'thumbs_up' | 'thumbs_down' | 'maybe'> = {
            GOOD: 'thumbs_up',
            OK: 'maybe',
            NO: 'thumbs_down',
          }
          await updateInterviewManagerRating(interview.id, ratingMap[body])
        }
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { context: 'manager_rating_sms', from } })
    }
    return twimlEmpty()
  }

  // Unrecognized — use AI to reply contextually
  try {
    const rawBody = params.Body?.trim() ?? ''
    if (rawBody.length > 0 && rawBody.length < 500) {
      const { data: applicant } = await adminDb
        .from('applicants')
        .select('id, name')
        .eq('phone', from)
        .maybeSingle()

      let context = 'The applicant has no active application on file.'
      let companyName = 'our company'

      if (applicant) {
        const { data: app } = await adminDb
          .from('applications')
          .select('id, status, company_id, jobs(title), locations(name, timezone)')
          .eq('applicant_id', applicant.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (app) {
          const job = (app.jobs as unknown as { title: string } | null)?.title ?? 'a position'
          const location = (app.locations as unknown as { name: string } | null)?.name ?? ''
          const { displayName } = await import('@/lib/db/companies').then(m => m.getCompanyConfig(app.company_id))
          companyName = displayName
          context = `Applicant: ${applicant.name}. Applied for: ${job}${location ? ` at ${location}` : ''}. Current status: ${app.status.replace(/_/g, ' ')}.`
        }
      }

      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: `You are a friendly hiring assistant for ${companyName}. Reply to applicant SMS messages briefly and helpfully. Keep responses under 140 characters. ${context} If asked about pay/hours/schedule, say a manager will follow up. Never make up specific details. End with "- ${companyName} Hiring".`,
          },
          { role: 'user', content: rawBody },
        ],
      })
      const reply = completion.choices[0]?.message?.content?.trim()
      if (reply) return twimlResponse(reply)
    }
  } catch { /* fall through to empty */ }

  return twimlEmpty()
}
