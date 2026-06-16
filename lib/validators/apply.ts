import { z } from 'zod'

export const ApplySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  companySlug: z.string().min(1),
  locationSlug: z.string().min(1),
  jobSlug: z.string().min(1),
  preferEmail: z.boolean().optional(),
  website: z.string().optional(), // honeypot
  responses: z.record(z.string(), z.array(z.string())).optional(),
  source: z.string().max(50).optional(),
})

export type ApplyInput = z.infer<typeof ApplySchema>
