import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/supabase/admin'
import { twilioClient } from '@/lib/twilio/client'

// Fix 2: drain pending_sms rows whose send_after has passed
export async function drainPendingSms(): Promise<void> {
  const { data: rows, error } = await adminDb
    .from('pending_sms')
    .select('*')
    .is('sent_at', null)
    .lte('send_after', new Date().toISOString())
    .order('send_after', { ascending: true })
    .limit(100)

  if (error) throw new Error(`drainPendingSms query failed: ${error.message}`)

  for (const row of rows ?? []) {
    try {
      const msg = await twilioClient.messages.create({
        to: row.to_phone,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body: row.body,
        statusCallback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`,
      })

      // Mark sent and log
      await adminDb
        .from('pending_sms')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', row.id)

      await adminDb.from('sms_log').insert({
        application_id: row.application_id,
        to_phone: row.to_phone,
        message_type: row.message_type,
        direction: 'outbound',
        twilio_sid: msg.sid,
        status: 'queued',
      })
    } catch (err) {
      Sentry.captureException(err, { extra: { pendingSmsId: row.id } })
    }
  }
}
