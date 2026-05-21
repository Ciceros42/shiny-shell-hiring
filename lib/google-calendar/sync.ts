import { google } from 'googleapis'
import { createOAuth2Client, getAccessToken, encrypt } from './client'
import { adminDb } from '@/lib/supabase/admin'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function getOAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [CALENDAR_SCOPE],
    state: userId,
    prompt: 'consent', // force refresh_token on every connect
  })
}

export async function handleOAuthCallback(code: string, userId: string): Promise<void> {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.access_token) throw new Error('OAuth callback missing access_token')

  const encrypted = encrypt(JSON.stringify(tokens))
  await adminDb
    .from('profiles')
    .update({
      calendar_token_encrypted: encrypted,
      calendar_token_created_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

// Feature A: manager_briefing injected into event description
export async function createInterviewEvent({
  interviewId,
  applicantName,
  slotStartTime,
  slotEndTime,
  locationName,
  locationAddress,
  managerBriefing,
  managerUserId,
}: {
  interviewId: string
  applicantName: string
  slotStartTime: string
  slotEndTime: string
  locationName: string
  locationAddress: string | null
  managerBriefing: string | null
  managerUserId: string
}): Promise<{ googleEventId: string }> {
  const accessToken = await getAccessToken(managerUserId)
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const descriptionParts = [`Interview with ${applicantName}`]
  if (managerBriefing) {
    descriptionParts.push('', '--- AI Briefing ---', managerBriefing)
  }
  descriptionParts.push('', `Interview ID: ${interviewId}`)

  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `Shiny Shell Interview — ${applicantName}`,
      description: descriptionParts.join('\n'),
      location: locationAddress ?? locationName,
      start: { dateTime: slotStartTime, timeZone: 'UTC' },
      end: { dateTime: slotEndTime, timeZone: 'UTC' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    },
  })

  const googleEventId = event.data.id
  if (!googleEventId) throw new Error('Google Calendar returned no event ID')

  return { googleEventId }
}

export async function cancelEvent(managerUserId: string, googleEventId: string): Promise<void> {
  const accessToken = await getAccessToken(managerUserId)
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId })
}
