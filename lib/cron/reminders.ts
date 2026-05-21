import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { addToTalentPool } from '@/lib/db/applicants'
import { formatInterviewDateTime } from '@/lib/scheduling/slots'

type AppJoin = { applicants: { phone: string } | null; locations: { timezone: string } | null }
type ExpiredJoin = { applicant_id: string; location_id: string }

// Feature F: alert manager when < 3 slots in next 7 days (rate-limited to once/24h)
export async function checkSlotShortage(): Promise<void> {
  const { data: locations } = await adminDb
    .from('locations')
    .select('id, name, manager_user_id, timezone, slot_shortage_sms_sent_at')
    .eq('is_hiring', true)

  for (const loc of locations ?? []) {
    const sentAt = loc.slot_shortage_sms_sent_at ? new Date(loc.slot_shortage_sms_sent_at as string) : null
    if (sentAt && Date.now() - sentAt.getTime() < 24 * 60 * 60 * 1000) continue

    const { count } = await adminDb
      .from('interview_slots')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', loc.id)
      .eq('is_available', true)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())

    if ((count ?? 0) < 3) {
      const { data: profile } = await adminDb
        .from('profiles')
        .select('phone')
        .eq('id', loc.manager_user_id)
        .maybeSingle()

      const phone = (profile as { phone?: string } | null)?.phone
      if (!phone) continue

      const calUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/admin/calendar`
      await sendSMS(phone, SMS.slotShortage(calUrl), null, 'slot_shortage', loc.timezone as string, { bypassQuietHours: false })
      await adminDb.from('locations').update({ slot_shortage_sms_sent_at: new Date().toISOString() }).eq('id', loc.id)
    }
  }
}

export async function runReminders(): Promise<void> {
  await checkSlotShortage()
  await sendScreenLinkReminders()
  await expireStaleScreenLinks()
  await sendInterviewReminders()
  await sendManagerFitPrompts()
  await alertStuckScreening()
}

async function sendScreenLinkReminders(): Promise<void> {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: links4h } = await adminDb
    .from('magic_links')
    .select('id, token, application_id, applications(applicants(phone), locations(timezone))')
    .eq('type', 'screen')
    .eq('reminder_4h_sent', false)
    .is('clicked_at', null)
    .lt('created_at', fourHoursAgo)
    .gt('expires_at', now)
    .limit(50)

  for (const link of links4h ?? []) {
    try {
      const app = link.applications as unknown as AppJoin
      const phone = app?.applicants?.phone
      const timezone = app?.locations?.timezone ?? 'America/Denver'
      if (!phone) continue
      const screenUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/screen/${link.token}`
      await sendSMS(phone, SMS.screenReminder(screenUrl), link.application_id, 'screen_reminder_4h', timezone)
      await adminDb.from('magic_links').update({ reminder_4h_sent: true }).eq('id', link.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { magicLinkId: link.id } })
    }
  }

  const { data: links20h } = await adminDb
    .from('magic_links')
    .select('id, token, application_id, applications(applicants(phone), locations(timezone))')
    .eq('type', 'screen')
    .eq('reminder_20h_sent', false)
    .is('clicked_at', null)
    .lt('created_at', twentyHoursAgo)
    .gt('expires_at', now)
    .limit(50)

  for (const link of links20h ?? []) {
    try {
      const app = link.applications as unknown as AppJoin
      const phone = app?.applicants?.phone
      const timezone = app?.locations?.timezone ?? 'America/Denver'
      if (!phone) continue
      const screenUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/screen/${link.token}`
      await sendSMS(phone, SMS.screenReminder(screenUrl), link.application_id, 'screen_reminder_20h', timezone)
      await adminDb.from('magic_links').update({ reminder_20h_sent: true }).eq('id', link.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { magicLinkId: link.id } })
    }
  }
}

async function expireStaleScreenLinks(): Promise<void> {
  const { data: expired } = await adminDb
    .from('magic_links')
    .select('id, application_id, applications(applicant_id, location_id)')
    .eq('type', 'screen')
    .is('clicked_at', null)
    .lt('expires_at', new Date().toISOString())
    .is('completed_at', null)
    .limit(50)

  for (const link of expired ?? []) {
    try {
      const app = link.applications as unknown as ExpiredJoin
      if (!app) continue
      await addToTalentPool(app.applicant_id, app.location_id, 'didnt_engage')
      await adminDb.from('applications').update({ status: 'failed' }).eq('id', link.application_id)
      await adminDb.from('magic_links').update({ completed_at: new Date().toISOString() }).eq('id', link.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { magicLinkId: link.id } })
    }
  }
}

async function sendInterviewReminders(): Promise<void> {
  const now = new Date()
  type SlotJoin = { start_time: string; locations: { name: string; timezone: string } | null }
  type AppPhone = { applicants: { phone: string } | null }

  // Day-before reminder
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const { data: upcoming } = await adminDb
    .from('interviews')
    .select('id, application_id, reminder_day_before_sent, interview_slots(start_time, locations(name, timezone)), applications(applicants(phone))')
    .eq('status', 'scheduled')
    .eq('reminder_day_before_sent', false)
    .gte('interview_slots.start_time', tomorrow.toISOString())
    .lte('interview_slots.start_time', tomorrowEnd.toISOString())
    .limit(50)

  for (const interview of upcoming ?? []) {
    try {
      const slot = interview.interview_slots as unknown as SlotJoin
      const phone = (interview.applications as unknown as AppPhone)?.applicants?.phone
      if (!phone || !slot) continue
      const timezone = slot.locations?.timezone ?? 'America/Denver'
      const dateStr = formatInterviewDateTime(slot.start_time, timezone)
      await sendSMS(phone, SMS.interviewReminder(dateStr), interview.application_id, 'interview_reminder_day', timezone)
      await adminDb.from('interviews').update({ reminder_day_before_sent: true }).eq('id', interview.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { interviewId: interview.id } })
    }
  }

  // Same-day 1h reminder
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const { data: imminent } = await adminDb
    .from('interviews')
    .select('id, application_id, interview_slots(start_time, locations(timezone)), applications(applicants(phone))')
    .eq('status', 'scheduled')
    .eq('reminder_1h_before_sent', false)
    .gte('interview_slots.start_time', oneHourFromNow.toISOString())
    .lte('interview_slots.start_time', twoHoursFromNow.toISOString())
    .limit(50)

  for (const interview of imminent ?? []) {
    try {
      const slot = interview.interview_slots as unknown as SlotJoin
      const phone = (interview.applications as unknown as AppPhone)?.applicants?.phone
      if (!phone || !slot) continue
      const timezone = slot.locations?.timezone ?? 'America/Denver'
      const timeStr = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
      }).format(new Date(slot.start_time))
      await sendSMS(phone, SMS.interviewReminderSameDay(timeStr), interview.application_id, 'interview_reminder_1h', timezone)
      await adminDb.from('interviews').update({ reminder_1h_before_sent: true }).eq('id', interview.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { interviewId: interview.id } })
    }
  }
}

async function sendManagerFitPrompts(): Promise<void> {
  type FitSlot = { start_time: string; locations: { manager_user_id: string; timezone: string } | null }
  type FitApp = { applicants: { name: string } | null }

  const { data: interviews } = await adminDb
    .from('interviews')
    .select('id, application_id, interview_slots(start_time, locations(manager_user_id, timezone)), applications(applicants(name))')
    .eq('status', 'scheduled')
    .eq('fit_prompt_sent', false)
    .lt('interview_slots.start_time', new Date().toISOString())
    .limit(50)

  for (const interview of interviews ?? []) {
    try {
      const slot = interview.interview_slots as unknown as FitSlot
      const applicantName = (interview.applications as unknown as FitApp)?.applicants?.name ?? 'the applicant'
      if (!slot?.locations?.manager_user_id) continue

      const { data: profile } = await adminDb
        .from('profiles').select('phone').eq('id', slot.locations.manager_user_id).maybeSingle()
      const managerPhone = (profile as { phone?: string } | null)?.phone
      if (!managerPhone) continue

      await sendSMS(managerPhone, SMS.managerFitPrompt(applicantName), interview.application_id, 'manager_fit_prompt', slot.locations.timezone)
      await adminDb.from('interviews').update({ fit_prompt_sent: true }).eq('id', interview.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { interviewId: interview.id } })
    }
  }
}

async function alertStuckScreening(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: stuck } = await adminDb
    .from('applications')
    .select('id')
    .eq('status', 'screening')
    .lt('updated_at', thirtyMinutesAgo)
    .limit(10)

  if ((stuck ?? []).length > 0) {
    Sentry.captureMessage(`${stuck!.length} application(s) stuck in 'screening' > 30min`, {
      level: 'warning',
      extra: { ids: stuck!.map((a) => a.id) },
    })
  }
}
