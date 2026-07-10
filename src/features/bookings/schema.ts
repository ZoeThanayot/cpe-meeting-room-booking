// Zod schema for booking feature — used to validate both client-side (RHF) and server-side (action)
import { z } from 'zod'

export const createBookingSchema = z
  .object({
    roomId: z.string().uuid(),
    meetingName: z.string().min(1, 'Please enter a meeting name'),
    startTime: z.string().datetime(), // ISO string e.g. 2026-07-10T09:00:00Z
    endTime: z.string().datetime(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  })

export type CreateBookingInput = z.infer<typeof createBookingSchema>
