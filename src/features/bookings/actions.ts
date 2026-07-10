'use server'

// Example Server Action: Create booking + prevent overlapping times
// This is the "standard pattern" that all write operations should follow
import { createClient } from '@/lib/supabase/server'
import { createBookingSchema, type CreateBookingInput } from './schema'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function createBooking(
  input: CreateBookingInput,
): Promise<ActionResult> {
  // 1) Always validate server-side (do not trust the client)
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }

  const supabase = await createClient()

  // 2) User must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in' }

  // 3) Insert — RLS restricts user_id to match the user's own ID (or admin)
  const { error } = await supabase.from('bookings').insert({
    room_id: parsed.data.roomId,
    user_id: user.id,
    meeting_name: parsed.data.meetingName,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  })

  // 4) Catch double-booking error from EXCLUDE constraint (SQLSTATE 23P01)
  if (error) {
    if (error.code === '23P01') {
      return { ok: false, error: 'This time slot has already been booked' }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
