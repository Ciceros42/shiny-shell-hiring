import { adminDb } from '@/lib/supabase/admin'

export interface Interview {
  id: string
  applicationId: string
  slotId: string
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled'
  managerRating: string | null
  googleEventId: string | null
  meetLink: string | null
  createdAt: string
}

export interface InterviewWithSlot extends Interview {
  slot: {
    startTime: string
    endTime: string
    locationId: string
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const { data } = await adminDb.from('interviews').select('*').eq('id', id).maybeSingle()
  return data ? mapInterview(data) : null
}

export async function getScheduledInterviewByApplicationId(
  applicationId: string
): Promise<InterviewWithSlot | null> {
  const { data } = await adminDb
    .from('interviews')
    .select('*, interview_slots(start_time, end_time, location_id)')
    .eq('application_id', applicationId)
    .eq('status', 'scheduled')
    .maybeSingle()

  if (!data) return null

  const slot = data.interview_slots as {
    start_time: string
    end_time: string
    location_id: string
  } | null

  return {
    ...mapInterview(data),
    slot: {
      startTime: slot?.start_time ?? '',
      endTime: slot?.end_time ?? '',
      locationId: slot?.location_id ?? '',
    },
  }
}

export async function markInterviewRescheduled(interviewId: string): Promise<void> {
  const { data: interview } = await adminDb
    .from('interviews')
    .select('slot_id, google_event_id, interview_slots(manager_user_id)')
    .eq('id', interviewId)
    .single()

  if (interview) {
    // Free the slot so another candidate can book it
    await adminDb
      .from('interview_slots')
      .update({ is_available: true })
      .eq('id', interview.slot_id)

    // Cancel the Google Calendar event — non-fatal if it fails
    const googleEventId = interview.google_event_id as string | null
    const slot = (interview.interview_slots as unknown) as { manager_user_id: string } | null
    if (googleEventId && slot?.manager_user_id) {
      try {
        const { cancelEvent } = await import('@/lib/google-calendar/sync')
        await cancelEvent(slot.manager_user_id, googleEventId)
      } catch {
        // calendar cancel failure does not block the reschedule
      }
    }
  }

  await adminDb
    .from('interviews')
    .update({ status: 'rescheduled', google_event_id: null })
    .eq('id', interviewId)
}

export async function updateInterviewManagerRating(
  interviewId: string,
  rating: 'thumbs_up' | 'thumbs_down' | 'maybe'
): Promise<void> {
  await adminDb.from('interviews').update({ manager_rating: rating }).eq('id', interviewId)
}

export async function updateInterviewGoogleEventId(
  interviewId: string,
  googleEventId: string,
  meetLink?: string | null
): Promise<void> {
  await adminDb
    .from('interviews')
    .update({ google_event_id: googleEventId, ...(meetLink !== undefined && { meet_link: meetLink }) })
    .eq('id', interviewId)
}

function mapInterview(row: Record<string, unknown>): Interview {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    slotId: row.slot_id as string,
    status: row.status as Interview['status'],
    managerRating: (row.manager_rating as string | null) ?? null,
    googleEventId: (row.google_event_id as string | null) ?? null,
    meetLink: (row.meet_link as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}
