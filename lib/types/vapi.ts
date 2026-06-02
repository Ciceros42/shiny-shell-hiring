export interface VapiAssistantConfig {
  assistantPersonaName: string
  companyName: string
  jobTitle: string
  voiceId: string
  openingLine: string
  closingLine: string
  payAndScheduleResponse: string
  maxCallDurationMinutes: number
  tone: 'friendly' | 'professional' | 'casual'
}

export const DEFAULT_VAPI_CONFIG: VapiAssistantConfig = {
  assistantPersonaName: 'Alex',
  companyName: '',
  jobTitle: 'Team Member',
  voiceId: 'paula',
  openingLine:
    "Hi {{applicantName}}! This is Alex calling — I'm reaching out about your job application. Do you have a few minutes to answer some quick screening questions?",
  closingLine:
    "Thanks so much for chatting with us today! Someone from the team will be in touch soon about next steps. Have a great day!",
  payAndScheduleResponse:
    "Great question! The hiring manager will go over all the details including pay and scheduling at the interview.",
  maxCallDurationMinutes: 5,
  tone: 'friendly',
}

export const VOICE_OPTIONS = [
  { id: 'paula', label: 'Paula — female, warm' },
  { id: 'rachel', label: 'Rachel — female, clear' },
  { id: 'sarah', label: 'Sarah — female, friendly' },
  { id: 'josh', label: 'Josh — male, young' },
  { id: 'adam', label: 'Adam — male, deep' },
  { id: 'arnold', label: 'Arnold — male, authoritative' },
]

export const TONE_OPTIONS = [
  { id: 'friendly', label: 'Friendly & upbeat' },
  { id: 'professional', label: 'Professional & formal' },
  { id: 'casual', label: 'Casual & relaxed' },
]
