import { adminDb } from '@/lib/supabase/admin'
import { updateApplicationStatus } from '@/lib/db/applications'
import { createMagicLink } from '@/lib/db/magic-links'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { addToTalentPool } from '@/lib/db/applicants'
import { sendPassEmail } from '@/lib/email/send'

export async function advanceApplicant(applicationId: string): Promise<void> {
  // Load application + applicant + location
  const { data: app } = await adminDb
    .from('applications')
    .select('applicant_id, location_id, applicants(id, phone, email, sms_opted_out, name), locations(id, timezone)')
    .eq('id', applicationId)
    .single()

  if (!app) throw new Error('Application not found')

  const applicant = app.applicants as unknown as { id: string; phone: string; email: string | null; name: string; smsOptedOut: boolean; sms_opted_out: boolean } | null
  const location = app.locations as unknown as { id: string; timezone: string } | null
  if (!applicant || !location) throw new Error('Applicant or location not found')

  await updateApplicationStatus(applicationId, 'passed')

  // Notification failures should not block the status update
  try {
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const earliestBookable = new Date(Date.now() + 30 * 60 * 1000)

    await createMagicLink({ type: 'schedule', applicationId, token, expiresAt, earliestBookable })

    const scheduleUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/schedule/${token}`
    const useEmail = applicant.sms_opted_out && !!applicant.email
    if (useEmail) {
      await sendPassEmail({ to: applicant.email!, name: applicant.name, scheduleUrl })
    } else {
      await sendSMS(applicant.phone, SMS.pass(scheduleUrl), applicationId, 'pass', location.timezone, { bypassQuietHours: true })
    }
    await addToTalentPool(applicant.id, location.id, 'passed_no_schedule')
  } catch (err) {
    console.error('[advanceApplicant] notification failed:', err)
  }
}

export async function rejectApplicant(applicationId: string): Promise<void> {
  await updateApplicationStatus(applicationId, 'rejected')
}
