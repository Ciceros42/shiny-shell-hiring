import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabase/admin'
import { createInterviewEvent } from '@/lib/google/calendar'
import { getCompanyConfig } from '@/lib/db/companies'

export async function POST(req: Request) {
  if (process.env.ENABLE_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { companyId: bodyCompanyId, locationId: bodyLocationId } = body as Record<string, string>

  // Pick location
  const locationQuery = adminDb
    .from('locations')
    .select('id, name, timezone, company_id, manager_user_id')
    .eq('is_hiring', true)
    .limit(1)
  if (bodyLocationId) locationQuery.eq('id', bodyLocationId)
  else if (bodyCompanyId) locationQuery.eq('company_id', bodyCompanyId)

  const { data: locations } = await locationQuery
  const location = locations?.[0]
  if (!location) {
    return NextResponse.json({ error: 'No active hiring location found' }, { status: 404 })
  }

  // Pick job
  const { data: jobs } = await adminDb
    .from('jobs')
    .select('id, title, question_set_id')
    .eq('company_id', location.company_id)
    .eq('is_active', true)
    .not('question_set_id', 'is', null)
    .limit(1)
  const job = jobs?.[0]
  if (!job) {
    return NextResponse.json({ error: 'No active job with a question set found' }, { status: 404 })
  }

  // Create test applicant
  const ts = Date.now()
  const { data: applicant, error: applicantError } = await adminDb
    .from('applicants')
    .insert({
      name: `Test Applicant ${ts}`,
      phone: `+1555000${String(ts).slice(-4)}`,
      email: `test+${ts}@dev.local`,
      sms_opted_out: true,
    })
    .select()
    .single()
  if (applicantError || !applicant) {
    return NextResponse.json({ error: `Failed to create applicant: ${applicantError?.message}` }, { status: 500 })
  }

  // Create application
  const { data: application, error: appError } = await adminDb
    .from('applications')
    .insert({
      applicant_id: applicant.id,
      company_id: location.company_id,
      location_id: location.id,
      job_id: job.id,
      question_set_id: job.question_set_id,
      status: 'passed',
      source: 'dev_seed',
      availability: {},
    })
    .select()
    .single()
  if (appError || !application) {
    return NextResponse.json({ error: `Failed to create application: ${appError?.message}` }, { status: 500 })
  }

  // Create a screen result so the panel renders properly
  await adminDb.from('screen_results').insert({
    application_id: application.id,
    passed: true,
    qualitative_summary: '[Dev seed] This applicant was generated for testing. Strong communication skills, available full-time, passed all screening questions.',
    manager_briefing: '[Dev seed] Highly recommended. Available immediately. Answered all questions correctly. No concerns.',
    scores_json: {},
    total_score: 85,
    threshold_at_time: 60,
  })

  // Create a slot in the past (2h ago → 1h ago) so it's already "expired" for cron testing
  const slotStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const slotEnd = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()

  const { data: slot, error: slotError } = await adminDb
    .from('interview_slots')
    .insert({
      location_id: location.id,
      manager_user_id: location.manager_user_id,
      start_time: slotStart,
      end_time: slotEnd,
      is_available: true,
    })
    .select()
    .single()
  if (slotError || !slot) {
    return NextResponse.json({ error: `Failed to create slot: ${slotError?.message}` }, { status: 500 })
  }

  // Book the slot via RPC (same path as the real booking)
  const { data: interviewId, error: rpcError } = await adminDb.rpc('book_slot', {
    p_slot_id: slot.id,
    p_application_id: application.id,
  })
  if (rpcError) {
    return NextResponse.json({ error: `book_slot RPC failed: ${rpcError.message}` }, { status: 500 })
  }

  // Update application to scheduled
  await adminDb.from('applications').update({ status: 'scheduled' }).eq('id', application.id)

  // Create Google Meet event (real event on manager's calendar)
  let meetLink: string | null = null
  let googleEventId: string | null = null
  let calendarError: string | null = null

  try {
    const { displayName: companyName } = await getCompanyConfig(location.company_id)
    const result = await createInterviewEvent({
      interviewId: interviewId as string,
      applicantName: applicant.name,
      slotStartTime: slotStart,
      slotEndTime: slotEnd,
      locationName: location.name,
      locationAddress: null,
      managerBriefing: '[Dev seed] Test interview — no real briefing.',
      managerUserId: location.manager_user_id,
      companyName,
    })
    meetLink = result.meetLink
    googleEventId = result.googleEventId
    await adminDb
      .from('interviews')
      .update({ google_event_id: googleEventId, meet_link: meetLink })
      .eq('id', interviewId as string)
  } catch (err) {
    calendarError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    ok: true,
    appId: application.id,
    interviewId,
    meetLink,
    googleEventId,
    calendarError,
    note: calendarError
      ? 'Applicant seeded to scheduled status. Google Meet creation failed — manager may not have calendar connected.'
      : 'Applicant seeded to scheduled status with Google Meet. Use /api/dev/force-interviewed to advance without waiting.',
  })
}
