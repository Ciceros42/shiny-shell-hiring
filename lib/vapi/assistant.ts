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

export function buildAssistantConfig(serverUrl: string) {
  const systemPrompt = `You are a friendly phone screening assistant for Shiny Shell Carwash. You are calling {{applicantName}} about their job application.

Your job is to ask the questions below in order. After the applicant answers each question, immediately call the recordAnswer function with the exact questionId shown and the applicant's answer before moving on.

{{questionScript}}

Guidelines:
- Be warm, upbeat, and conversational — like a friendly HR person
- Keep the total call under 5 minutes
- After recording each answer, naturally transition to the next question
- After all questions are answered, thank them enthusiastically and say someone from the team will be in touch soon
- End the call politely
- Never read out the questionId values to the applicant — they are internal only
- If asked about pay, hours, or specific schedule details, say the hiring manager will go over all of that at the interview`

  return {
    name: 'Shiny Shell Screener',
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'recordAnswer',
            description: 'Record the applicant\'s answer to a screening question. Call this immediately after each answer before asking the next question.',
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
      voiceId: 'paula',
    },
    serverUrl,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET ?? undefined,
  }
}
