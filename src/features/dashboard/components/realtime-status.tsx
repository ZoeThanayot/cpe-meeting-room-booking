'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Database } from '@/types/database'
import { BookingForm } from '@/features/bookings/components/booking-form'
import { Loader2, Plus, Users, MapPin, Layers, CheckCircle2, AlertCircle } from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { Button } from '@/components/ui/button'

type Room = Database['public']['Tables']['rooms']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']

interface RealtimeStatusProps {
  rooms: Room[]
}

export function RealtimeStatus({ rooms }: RealtimeStatusProps) {
  const supabase = createClient()

  // State
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalInitialRoomId, setModalInitialRoomId] = useState('')

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'booked')
      if (!error && data) {
        setBookings(data)
      }
    } catch (err) {
      console.error('Error fetching bookings:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle updates and timer ticking
  useEffect(() => {
    // Initial data load on mount — state updates happen after await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()

    // Keep current time ticking every second to update statuses instantly
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Realtime subscription
    const channel = supabase
      .channel('realtime-status-bookings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Helper to determine if a room is occupied right now
  const getRoomOccupancy = (roomId: string) => {
    const now = currentTime.getTime()
    const activeBooking = bookings.find((b) => {
      if (b.room_id !== roomId) return false
      const start = new Date(b.start_time).getTime()
      const end = new Date(b.end_time).getTime()
      return now >= start && now < end
    })
    return activeBooking || null
  }

  // Calculate statistics
  const totalRoomsCount = rooms.length
  let occupiedCount = 0
  rooms.forEach((room) => {
    if (getRoomOccupancy(room.id)) occupiedCount++
  })
  const availableCount = totalRoomsCount - occupiedCount

  // Selected room details — derived from state, falling back to the first
  // room so the detail panel is never empty (no pre-select effect needed)
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0] ?? null
  const currentBooking = selectedRoom ? getRoomOccupancy(selectedRoom.id) : null

  // Next booking today for selected room
  const getNextBooking = () => {
    if (!selectedRoom) return null
    const now = currentTime.getTime()

    // Bookings for this room that start later TODAY, ordered by start time
    const upcoming = bookings
      .filter((b) => {
        if (b.room_id !== selectedRoom.id) return false
        const start = new Date(b.start_time)
        return start.getTime() > now && isSameDay(start, currentTime)
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    return upcoming[0] || null
  }

  const nextBooking = getNextBooking()

  return (
    <div className="space-y-6">
      {/* Top Real-time Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Rooms
            </p>
            <h3 className="text-3xl font-extrabold text-zinc-950 dark:text-zinc-50 mt-1">
              {totalRoomsCount}
            </h3>
          </div>
          <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
            TR
          </div>
        </div>

        <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Available
            </p>
            <h3 className="text-3xl font-extrabold text-green-600 dark:text-green-400 mt-1">
              {availableCount}
            </h3>
          </div>
          <div className="h-10 w-10 bg-green-50 dark:bg-green-950/40 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Occupied
            </p>
            <h3 className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {occupiedCount}
            </h3>
          </div>
          <div className="h-10 w-10 bg-rose-50 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Room list */}
        <div className="lg:col-span-2 p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Room Status</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Click room to inspect details</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full font-mono">
              Live: {format(currentTime, 'HH:mm:ss')}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="divide-y divide-zinc-150 dark:divide-zinc-800/60 max-h-[500px] overflow-y-auto pr-1">
              {rooms.map((room) => {
                const occupancy = getRoomOccupancy(room.id)
                const isSelected = room.id === selectedRoom?.id

                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`flex items-center justify-between py-4 px-3 rounded-xl cursor-pointer transition-all duration-150 ${
                      isSelected 
                        ? 'bg-indigo-50/60 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`h-3 w-3 rounded-full shrink-0 ${
                        occupancy ? 'bg-rose-500 animate-pulse' : 'bg-green-500'
                      }`} />
                      <div>
                        <h4 className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                          {room.name}
                        </h4>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {room.room_type} room · Capacity {room.capacity}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                        occupancy 
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400' 
                          : 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400'
                      }`}>
                        {occupancy ? 'Occupied' : 'Available'}
                      </span>
                      
                      <button
                        onClick={() => {
                          setModalInitialRoomId(room.id)
                          setIsModalOpen(true)
                        }}
                        className="p-1.5 bg-zinc-100 hover:bg-indigo-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-indigo-600 rounded-lg text-zinc-500 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detailed Room Panel */}
        <div className="lg:col-span-1 p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl flex flex-col justify-between space-y-6">
          {selectedRoom ? (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedRoom.name}
                </h3>
                <span className="text-xs text-zinc-500">Selected Room Details</span>
              </div>

              {/* Room Metadata */}
              <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-850 rounded-xl">
                <div className="flex items-center space-x-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <Users className="h-4 w-4 text-zinc-400" />
                  <span>Max Capacity: <strong>{selectedRoom.capacity} people</strong></span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <MapPin className="h-4 w-4 text-zinc-400" />
                  <span>Location: <strong>{selectedRoom.location || 'N/A'}</strong></span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <Layers className="h-4 w-4 text-zinc-400" />
                  <span>Type: <strong className="capitalize">{selectedRoom.room_type} Room</strong></span>
                </div>
              </div>

              {/* Current Occupancy Status */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Current Status
                </h4>
                {currentBooking ? (
                  <div className="p-4 border border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      OCCUPIED NOW
                    </p>
                    <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-200">
                      {currentBooking.meeting_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Time: {format(new Date(currentBooking.start_time), 'HH:mm')} - {format(new Date(currentBooking.end_time), 'HH:mm')}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 border border-green-200 dark:border-green-900/40 bg-green-50/20 dark:bg-green-950/10 rounded-xl">
                    <p className="text-xs font-bold text-green-600 dark:text-green-400">
                      AVAILABLE NOW
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      This room is currently empty and open for booking.
                    </p>
                  </div>
                )}
              </div>

              {/* Next Booking */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Next Booking Today
                </h4>
                {nextBooking ? (
                  <div className="p-4 border border-zinc-150 dark:border-zinc-800 rounded-xl space-y-1">
                    <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-200">
                      {nextBooking.meeting_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Time: {format(new Date(nextBooking.start_time), 'HH:mm')} - {format(new Date(nextBooking.end_time), 'HH:mm')}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic pl-1">
                    No further bookings scheduled for today.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic text-center py-20">Select a room to see details.</p>
          )}

          {selectedRoom && (
            <Button
              onClick={() => {
                setModalInitialRoomId(selectedRoom.id)
                setIsModalOpen(true)
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Book This Room
            </Button>
          )}
        </div>
      </div>

      {/* Book Room Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  New Reservation
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Book a department meeting room</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>
            
            <BookingForm
              rooms={rooms}
              initialRoomId={modalInitialRoomId}
              onSuccess={() => {
                setIsModalOpen(false)
                fetchBookings()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
