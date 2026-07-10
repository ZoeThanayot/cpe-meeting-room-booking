'use server'

// Example Server Action: Create booking + prevent overlapping times
// This is the "standard pattern" that all write operations should follow
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { bookingFormSchema, type BookingFormInput } from './schema'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function createBooking(
  input: BookingFormInput,
): Promise<ActionResult> {
  // 1) Always validate server-side (do not trust the client)
  const parsed = bookingFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }

  const supabase = await createClient()

  // 2) User must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in' }

  // Parse local timezone date and time into JavaScript Dates, then to ISO UTC string
  const startIso = new Date(`${parsed.data.date}T${parsed.data.startTime}:00`).toISOString()
  const endIso = new Date(`${parsed.data.date}T${parsed.data.endTime}:00`).toISOString()

  // 3) Insert — RLS restricts user_id to match the user's own ID (or admin)
  const { error } = await supabase.from('bookings').insert({
    room_id: parsed.data.roomId,
    user_id: user.id,
    meeting_name: parsed.data.meetingName,
    start_time: startIso,
    end_time: endIso,
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

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // 1) User must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in' }

  // 2) Update status to 'cancelled' — RLS guarantees user owns it or is admin
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
