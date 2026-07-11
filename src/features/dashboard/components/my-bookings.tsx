'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Database } from '@/types/database'
import { cancelBooking } from '@/features/bookings/actions'
import { toast } from 'sonner'
import { Calendar, Trash2, Loader2, Clock, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'

type Room = Database['public']['Tables']['rooms']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']

interface MyBookingsProps {
  rooms: Room[]
}

export function MyBookings({ rooms }: MyBookingsProps) {
  const supabase = createClient()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Note: no synchronous setLoading(true) here — `loading` starts true and
  // realtime refetches update the list silently without flashing the spinner
  const fetchMyBookings = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', currentUserId)
        .order('start_time', { ascending: false })

      if (!error && data) {
        setBookings(data)
      }
    } catch (err) {
      console.error('Error fetching own bookings:', err)
    } finally {
      setLoading(false)
    }
  }

  // Resolve the signed-in user once on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      } else {
        setLoading(false)
      }
    }
    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch bookings + subscribe to realtime changes once the user is known
  useEffect(() => {
    if (!userId) return

    // Initial data load — state updates happen after await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMyBookings(userId)

    const channel = supabase
      .channel('my-bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchMyBookings(userId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    setCancellingId(id)
    try {
      const result = await cancelBooking(id)
      if (result.ok) {
        toast.success('Booking cancelled successfully')
        if (userId) fetchMyBookings(userId)
      } else {
        toast.error(result.error || 'Failed to cancel booking')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setCancellingId(null)
    }
  }

  const getRoomName = (roomId: string) => {
    return rooms.find((r) => r.id === roomId)?.name || 'Unknown Room'
  }

  const getRoomType = (roomId: string) => {
    return rooms.find((r) => r.id === roomId)?.room_type || 'small'
  }

  return (
    <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl space-y-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-500" />
          My Bookings
        </h2>
        <p className="text-xs text-zinc-500 mt-1">Review and manage your meeting room reservations</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-full">
            <Calendar className="h-6 w-6 text-zinc-400" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">No Reservations</h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              You haven&apos;t made any room reservations yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-150 dark:border-zinc-800 pb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">Agenda / Title</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/60 text-sm">
              {bookings.map((booking) => {
                const roomType = getRoomType(booking.room_id)
                const isCancelled = booking.status === 'cancelled'
                const start = new Date(booking.start_time)
                const end = new Date(booking.end_time)

                return (
                  <tr
                    key={booking.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                  >
                    <td className="py-4 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                      {booking.meeting_name}
                    </td>
                    <td className="py-4 px-4">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          roomType === 'small' ? 'bg-indigo-600' : roomType === 'medium' ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        {getRoomName(booking.room_id)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        <span>
                          {format(start, 'dd MMM yyyy')} · {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                        isCancelled 
                          ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' 
                          : 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {!isCancelled && (
                        <button
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-rose-600 hover:bg-rose-50 hover:border-rose-100 dark:hover:bg-rose-950/20 dark:hover:border-rose-900/40 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {cancellingId === booking.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
