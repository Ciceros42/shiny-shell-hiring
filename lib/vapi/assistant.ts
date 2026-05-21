export interface AssistantOverrides {
  variableValues: Record<string, string>
}

interface Question {
  id: string
  variants: string[]
  type: 'hard_filter' | 'scored' | 'informational'
  order_index: number
}

// Picks one random variant per question to prevent candidates from sharing answers.
// Returns variableValues injected into the Vapi assistant at call time.
export function buildAssistantOverrides(
  applicantName: string,
  questions: Question[]
): AssistantOverrides {
  const sorted = [...questions].sort((a, b) => a.order_index - b.order_index)

  const questionScript = sorted
    .map((q, i) => {
      const variant = q.variants[Math.floor(Math.random() * q.variants.length)]
      return `Question ${i + 1}: ${variant}`
    })
    .join('\n')

  return {
    variableValues: {
      applicantName,
      questionScript,
    },
  }
}
