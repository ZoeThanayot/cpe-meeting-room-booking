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

export type BookingFormInput = z.infer<typeof bookingFormSchema>
