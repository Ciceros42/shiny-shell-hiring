// TypeScript types matching the actual Vapi webhook payload shapes.
// All events are wrapped under a top-level `message` object.
// Field names are camelCase throughout.

export interface VapiCall {
  id: string
  status: string
  endedAt?: string
  ended_at?: string  // fallback — some Vapi versions use snake_case
  startedAt?: string
  cost?: number
  customer?: { number: string }
  phoneNumberId?: string
  assistantId?: string
}

export interface VapiArtifact {
  transcript?: string
  messages?: Array<{ role: 'assistant' | 'user'; message: string }>
  recording?: { mono?: string; stereo?: string }
}

export interface VapiToolCall {
  id: string
  name: string
  parameters: Record<string, unknown>
}

// end-of-call-report
export interface VapiEndOfCallMessage {
  type: 'end-of-call-report'
  call: VapiCall
  artifact: VapiArtifact
  endedReason?: string
  timestamp?: number
}

// tool-calls (function calling mid-call)
export interface VapiToolCallsMessage {
  type: 'tool-calls'
  call: VapiCall
  toolCallList: VapiToolCall[]
  toolWithToolCallList?: Array<{
    name: string
    toolCall: VapiToolCall
  }>
}

// status-update
export interface VapiStatusUpdateMessage {
  type: 'status-update'
  call: VapiCall
  status: string
}

// transcript (streamed during call)
export interface VapiTranscriptMessage {
  type: 'transcript'
  role: 'assistant' | 'user'
  transcriptType: 'partial' | 'final'
  transcript: string
}

export type VapiMessage =
  | VapiEndOfCallMessage
  | VapiToolCallsMessage
  | VapiStatusUpdateMessage
  | VapiTranscriptMessage

// Top-level webhook payload — everything Vapi sends is wrapped under `message`
export interface VapiWebhookPayload {
  message: VapiMessage
}
