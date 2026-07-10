import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  roomType: z.enum(['small', 'medium', 'large'], {
    message: 'Please select a room type',
  }),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  location: z.string().min(1, 'Location is required'),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
