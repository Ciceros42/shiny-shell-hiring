import { z } from 'zod'

export const BookSlotSchema = z.object({
  slotId: z.string().uuid(),
})

export type BookSlotInput = z.infer<typeof BookSlotSchema>
