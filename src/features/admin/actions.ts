'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  createRoomSchema,
  updateRoomSchema,
  type CreateRoomInput,
  type UpdateRoomInput,
} from './schema'

type ActionResult = { ok: true } | { ok: false; error: string }

// Helper to assert current user is admin
async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized: Please sign in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required')
  }
}

export async function createRoom(input: CreateRoomInput): Promise<ActionResult> {
  try {
    await assertAdmin()
    
    const parsed = createRoomSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('rooms').insert({
      name: parsed.data.name,
      room_type: parsed.data.roomType,
      capacity: parsed.data.capacity,
      location: parsed.data.location,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || 'An unexpected error occurred' }
  }
}

export async function updateRoom(input: UpdateRoomInput): Promise<ActionResult> {
  try {
    await assertAdmin()

    const parsed = updateRoomSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('rooms')
      .update({
        name: parsed.data.name,
        room_type: parsed.data.roomType,
        capacity: parsed.data.capacity,
        location: parsed.data.location,
      })
      .eq('id', parsed.data.id)
      .select('id')

    if (error) {
      return { ok: false, error: error.message }
    }
    // RLS returns 0 updated rows (without an error) when the room is missing
    if (!data || data.length === 0) {
      return { ok: false, error: 'Room not found' }
    }

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    }
  }
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  try {
    await assertAdmin()

    const supabase = await createClient()

    // 1) First check if there are any active bookings for this room
    const { data: activeBookings, error: checkError } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'booked')

    if (checkError) {
      return { ok: false, error: checkError.message }
    }

    if (activeBookings && activeBookings.length > 0) {
      return {
        ok: false,
        error: 'Cannot delete room with active reservations. Cancel bookings first.',
      }
    }

    // 2) Delete room
    const { error } = await supabase.from('rooms').delete().eq('id', roomId)
    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || 'An unexpected error occurred' }
  }
}
