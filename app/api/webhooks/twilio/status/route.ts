import { adminDb } from '@/lib/supabase/admin'
import { getTwilioClient as twilioClient } from '@/lib/twilio/client'

// Fix 1: Price is NOT in the statusCallback body — update status immediately,
// then fetch price separately after delivery/failure.
export async function POST(req: Request) {
  const formData = await req.formData()
  const sid = formData.get('MessageSid') as string | null
  const status = formData.get('MessageStatus') as string | null

  if (!sid) return new Response(null, { status: 204 })

  if (status) {
    await adminDb.from('sms_log').update({ status }).eq('twilio_sid', sid)
  }

  if (status === 'delivered' || status === 'undelivered' || status === 'failed') {
    // Fire-and-forget price fetch — non-critical, best-effort
    twilioClient()
      .messages(sid)
      .fetch()
      .then(async (msg) => {
        if (msg.price) {
          await adminDb
            .from('sms_log')
            .update({ cost_usd: Math.abs(parseFloat(msg.price)) })
            .eq('twilio_sid', sid)
        }
      })
      .catch(() => {})
  }

  return new Response(null, { status: 204 })
}
