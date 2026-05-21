import { z } from 'zod'

export const ApplySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  locationSlug: z.string().min(1),
  availability: z.object({
    days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).min(1),
    shifts: z.array(z.enum(['morning', 'afternoon', 'evening'])).min(1),
  }),
  hasTransportation: z.boolean(),
  website: z.string().optional(), // honeypot
})

export type ApplyInput = z.infer<typeof ApplySchema>
