import { z } from 'zod'

const VapiCallSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  endedAt: z.string().optional(),
  ended_at: z.string().optional(),
  startedAt: z.string().optional(),
  cost: z.number().optional(),
  customer: z.object({ number: z.string() }).optional(),
  phoneNumberId: z.string().optional(),
  assistantId: z.string().optional(),
})

const VapiArtifactSchema = z.object({
  transcript: z.string().optional(),
  messages: z
    .array(z.object({ role: z.enum(['assistant', 'user']), message: z.string() }))
    .optional(),
  recording: z.object({ mono: z.string().optional(), stereo: z.string().optional() }).optional(),
})

const VapiToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  parameters: z.record(z.string(), z.unknown()),
})

const VapiEndOfCallMessageSchema = z.object({
  type: z.literal('end-of-call-report'),
  call: VapiCallSchema,
  artifact: VapiArtifactSchema,
  endedReason: z.string().optional(),
  timestamp: z.number().optional(),
})

const VapiToolCallsMessageSchema = z.object({
  type: z.literal('tool-calls'),
  call: VapiCallSchema,
  toolCallList: z.array(VapiToolCallSchema),
  toolWithToolCallList: z
    .array(z.object({ name: z.string(), toolCall: VapiToolCallSchema }))
    .optional(),
})

const VapiStatusUpdateMessageSchema = z.object({
  type: z.literal('status-update'),
  call: VapiCallSchema,
  status: z.string(),
})

const VapiTranscriptMessageSchema = z.object({
  type: z.literal('transcript'),
  role: z.enum(['assistant', 'user']),
  transcriptType: z.enum(['partial', 'final']),
  transcript: z.string(),
})

export const VapiMessageSchema = z.discriminatedUnion('type', [
  VapiEndOfCallMessageSchema,
  VapiToolCallsMessageSchema,
  VapiStatusUpdateMessageSchema,
  VapiTranscriptMessageSchema,
])

export const VapiWebhookPayloadSchema = z.object({
  message: VapiMessageSchema,
})

export type VapiWebhookPayload = z.infer<typeof VapiWebhookPayloadSchema>
