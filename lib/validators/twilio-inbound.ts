import { z } from 'zod'

export const TwilioSmsSchema = z.object({
  MessageSid: z.string(),
  Body: z.string().default(''),
  From: z.string(),
  To: z.string(),
  NumMedia: z.string().optional(),
  AccountSid: z.string().optional(),
})

export type TwilioSmsInput = z.infer<typeof TwilioSmsSchema>

export const TwilioStatusSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.string(),
  // Price is NOT in the callback body — must fetch separately
})
