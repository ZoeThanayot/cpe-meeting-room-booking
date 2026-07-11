import { z } from 'zod'

export const bookingFormSchema = z
  .object({
    roomId: z.string().uuid('Please select a meeting room'),
    meetingName: z.string().min(1, 'Please enter a meeting name'),
    date: z.string().min(1, 'Please select a date'),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid start time format'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid end time format'),
  })
  .refine(
    (data) => {
      if (!data.date || !data.startTime || !data.endTime) return false
      const start = new Date(`${data.date}T${data.startTime}:00`)
      const end = new Date(`${data.date}T${data.endTime}:00`)
      return end > start
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  .refine(
    (data) => {
      if (!data.date || !data.startTime) return true
      // 1-minute grace so a booking starting "right now" is still accepted
      const start = new Date(`${data.date}T${data.startTime}:00`)
      return start.getTime() > Date.now() - 60 * 1000
    },
    {
      message: 'Cannot book a time in the past',
      path: ['startTime'],
    }
  )

export type BookingFormInput = z.infer<typeof bookingFormSchema>

// Payload for the createBooking server action. Times arrive as ISO UTC
// strings converted on the CLIENT, where the user's local timezone is known —
// the server may run in a different timezone (e.g. UTC on Vercel), so it must
// never interpret wall-clock strings itself.
export const createBookingSchema = z
  .object({
    roomId: z.string().uuid('Please select a meeting room'),
    meetingName: z.string().min(1, 'Please enter a meeting name'),
    startIso: z.iso.datetime('Invalid start time'),
    endIso: z.iso.datetime('Invalid end time'),
  })
  .refine((data) => new Date(data.endIso) > new Date(data.startIso), {
    message: 'End time must be after start time',
    path: ['endIso'],
  })
  .refine((data) => new Date(data.startIso).getTime() > Date.now() - 60 * 1000, {
    message: 'Cannot book a time in the past',
    path: ['startIso'],
  })

export type CreateBookingInput = z.infer<typeof createBookingSchema>
