import type { VapiAssistantConfig } from '@/lib/types/vapi'

export interface AssistantOverrides {
  variableValues: Record<string, string>
}

interface Question {
  id: string
  variants: string[]
  type: 'hard_filter' | 'scored' | 'informational'
  order_index: number
}

// Picks one random variant per question and embeds the ID so the AI can call recordAnswer correctly.
export function buildAssistantOverrides(
  applicantName: string,
  questions: Question[]
): AssistantOverrides {
  const sorted = [...questions].sort((a, b) => a.order_index - b.order_index)

  const questionScript = sorted
    .map((q, i) => {
      const variant = q.variants[Math.floor(Math.random() * q.variants.length)]
      return `Question ${i + 1} [questionId: "${q.id}"]: ${variant}`
    })
    .join('\n')

  return {
    variableValues: {
      applicantName,
      questionScript,
    },
  }
}

function buildSystemPrompt(config: VapiAssistantConfig): string {
  const toneDesc = {
    friendly: 'warm, upbeat, and conversational — like a friendly HR person',
    professional: 'professional and courteous — clear and to the point',
    casual: 'casual and relaxed — like a friendly coworker',
  }[config.tone]

  return `You are a phone screening assistant named ${config.assistantPersonaName} for ${config.companyName}. You are calling {{applicantName}} about their application for the ${config.jobTitle} position.

Your opening line when the call connects: "${config.openingLine}"

Your job is to ask the questions below in order. After the applicant answers each question, immediately call the recordAnswer function with the exact questionId shown and the applicant's answer before moving on.

{{questionScript}}

Guidelines:
- Be ${toneDesc}
- Keep the total call under ${config.maxCallDurationMinutes} minutes
- After recording each answer, naturally transition to the next question
- After all questions are answered, say: "${config.closingLine}"
- End the call politely
- Never read out the questionId values to the applicant — they are internal only
- If asked about pay, hours, or specific schedule details, say: "${config.payAndScheduleResponse}"`
}

export function buildAssistantConfig(config: VapiAssistantConfig, serverUrl: string) {
  return {
    name: `${config.companyName} Screener`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: buildSystemPrompt(config) }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'recordAnswer',
            description:
              "Record the applicant's answer to a screening question. Call this immediately after each answer before asking the next question.",
            parameters: {
              type: 'object',
              properties: {
                questionId: {
                  type: 'string',
                  description: 'The questionId shown in brackets in the question script',
                },
                answerText: {
                  type: 'string',
                  description: "The applicant's answer, transcribed accurately and in full",
                },
              },
              required: ['questionId', 'answerText'],
            },
          },
        },
      ],
    },
    voice: {
      provider: '11labs',
      voiceId: config.voiceId,
    },
    serverUrl,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET ?? undefined,
  }
}
