import { adminDb } from '@/lib/supabase/admin'
import { updateApplicationStatus } from '@/lib/db/applications'
import { createMagicLink } from '@/lib/db/magic-links'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { addToTalentPool } from '@/lib/db/applicants'
import { sendPassEmail } from '@/lib/email/send'
import { getCompanyConfig } from '@/lib/db/companies'

export async function advanceApplicant(applicationId: string, companyId: string): Promise<{ notified: boolean }> {
  // Load application + applicant + location, scoped to company
  const { data: app } = await adminDb
    .from('applications')
    .select('applicant_id, location_id, status, applicants(id, phone, email, sms_opted_out, name), locations(id, timezone)')
    .eq('id', applicationId)
    .eq('company_id', companyId)
    .single()

  if (!app) throw new Error('Application not found')

  if (app.status !== 'screen_complete') throw new Error('Invalid status transition')

  const applicant = app.applicants as unknown as { id: string; phone: string; email: string | null; name: string; smsOptedOut: boolean; sms_opted_out: boolean } | null
  const location = app.locations as unknown as { id: string; timezone: string } | null
  if (!applicant || !location) throw new Error('Applicant or location not found')

  await updateApplicationStatus(applicationId, 'passed')

  // Notification failures should not block the status update
  try {
    // Check for an existing non-expired schedule magic link before creating a new one
    const now = new Date()
    const { data: existingLink } = await adminDb
      .from('magic_links')
      .select('token, expires_at')
      .eq('application_id', applicationId)
      .eq('type', 'schedule')
      .limit(1)
      .maybeSingle()

    let token: string
    if (existingLink && new Date(existingLink.expires_at) > now) {
      token = existingLink.token
    } else {
      token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
      const earliestBookable = new Date(Date.now() + 30 * 60 * 1000)
      await createMagicLink({ type: 'schedule', applicationId, token, expiresAt, earliestBookable })
    }

    const scheduleUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/schedule/${token}`
    const useEmail = applicant.sms_opted_out && !!applicant.email
    const { displayName: companyName } = await getCompanyConfig(companyId)
    if (useEmail) {
      await sendPassEmail({ to: applicant.email!, name: applicant.name, scheduleUrl, companyName })
    } else {
      await sendSMS(applicant.phone, SMS.pass(scheduleUrl, companyName), applicationId, 'pass', location.timezone, { bypassQuietHours: true })
    }
    await addToTalentPool(applicant.id, location.id, 'passed_no_schedule')
    return { notified: true }
  } catch {
    return { notified: false }
  }
}

export async function rejectApplicant(applicationId: string, companyId: string): Promise<void> {
  const { data: app } = await adminDb
    .from('applications')
    .select('applicant_id, location_id, applicants(phone, email, name, sms_opted_out), locations(timezone)')
    .eq('id', applicationId)
    .eq('company_id', companyId)
    .single()

  if (!app) throw new Error('Application not found')

  await updateApplicationStatus(applicationId, 'rejected')

  try {
    const applicant = app.applicants as unknown as { phone: string; email: string | null; name: string; sms_opted_out: boolean } | null
    const location = app.locations as unknown as { timezone: string } | null
    if (!applicant || !location) return

    const { displayName: companyName } = await getCompanyConfig(companyId)
    const useEmail = applicant.sms_opted_out && !!applicant.email
    if (useEmail) {
      const { sendFailEmail } = await import('@/lib/email/send')
      await sendFailEmail({ to: applicant.email!, name: applicant.name, companyName })
    } else {
      await sendSMS(applicant.phone, SMS.fail(companyName), applicationId, 'fail', location.timezone, { bypassQuietHours: true })
    }
  } catch {
    // Notification failure should not block the rejection
  }
}
