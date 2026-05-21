import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'

type AppJoin = {
  id: string
  location_id: string
  locations: { timezone: string } | null
  applicants: { phone: string; name: string } | null
}

export async function runRetentionCheckins(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const { data: checkins, error } = await adminDb
    .from('retention_checkins')
    .select('id, application_id, period_days, applications(id, location_id, locations(timezone), applicants(phone, name))')
    .lte('scheduled_for', today)
    .is('sent_at', null)
    .limit(50)

  if (error) { Sentry.captureException(error); return }

  for (const checkin of checkins ?? []) {
    try {
      const app = checkin.applications as unknown as AppJoin
      const applicant = app?.applicants
      const timezone = app?.locations?.timezone ?? 'America/Denver'
      if (!applicant?.phone || !applicant?.name) continue

      await sendSMS(applicant.phone, SMS.retentionCheckin(applicant.name), app.id, 'retention_checkin', timezone)
      await adminDb.from('retention_checkins').update({ sent_at: new Date().toISOString() }).eq('id', checkin.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { checkinId: checkin.id } })
    }
  }
}
