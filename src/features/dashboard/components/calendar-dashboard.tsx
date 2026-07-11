'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Database } from '@/types/database'
import { BookingForm } from '@/features/bookings/components/booking-form'
import { Search, Plus, Calendar as CalendarIcon, Info, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// FullCalendar React wrappers
import FullCalendar from '@fullcalendar/react'
import { type EventClickArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

type Room = Database['public']['Tables']['rooms']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']

interface CalendarDashboardProps {
  rooms: Room[]
}

export function CalendarDashboard({ rooms }: CalendarDashboardProps) {
  const supabase = createClient()
  const calendarRef = useRef<FullCalendar>(null)

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Filters state
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['small', 'medium', 'large'])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  // Dialog / Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalInitialRoomId, setModalInitialRoomId] = useState('')

  // Fetch bookings — `loading` starts true; realtime refetches update the
  // calendar silently instead of flashing the loading overlay
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

  // Subscribe to realtime database changes for bookings
  useEffect(() => {
    // Initial data load on mount — state updates happen after await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()

    const channel = supabase
      .channel('calendar-bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter bookings for calendar display
  const filteredBookings = bookings.filter((booking) => {
    const room = rooms.find((r) => r.id === booking.room_id)
    if (!room) return false

    // 1) Filter by room type
    const matchesType = selectedTypes.includes(room.room_type)

    // 2) Filter by search query (meeting name or room name)
    const matchesSearch =
      booking.meeting_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesType && matchesSearch
  })

  // Convert bookings to FullCalendar event format
  const events = filteredBookings.map((booking) => {
    const room = rooms.find((r) => r.id === booking.room_id)
    
    // Choose color base on room type
    let color = '#4f46e5' // Indigo for small
    if (room?.room_type === 'medium') color = '#d97706' // Amber
    if (room?.room_type === 'large') color = '#e11d48' // Rose

    return {
      id: booking.id,
      title: `${room?.name || 'Unknown Room'}: ${booking.meeting_name}`,
      start: booking.start_time,
      end: booking.end_time,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      extendedProps: {
        roomName: room?.name,
        roomType: room?.room_type,
        capacity: room?.capacity,
      },
    }
  })

  // Date selection syncs with FullCalendar view
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value
    setSelectedDate(dateStr)
    if (dateStr && calendarRef.current) {
      const api = calendarRef.current.getApi()
      api.gotoDate(dateStr)
    }
  }

  const handleRoomTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  // Handle Event Click to show details
  const handleEventClick = (info: EventClickArg) => {
    const { start, end } = info.event
    if (!start || !end) return
    const { roomName, roomType, capacity } = info.event.extendedProps
    toast(info.event.title, {
      description: `Room: ${roomName} (${roomType} room, capacity: ${capacity})\nTime: ${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
      icon: <Info className="h-4 w-4 text-indigo-500" />,
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar Filter Tools */}
      <div className="lg:col-span-1 p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl h-fit space-y-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-500" />
            Booking Filters
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Manage and filter calendar schedules</p>
        </div>

        {/* Book Room CTA */}
        <Button
          onClick={() => {
            setModalInitialRoomId('')
            setIsModalOpen(true)
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Book a Room
        </Button>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Date Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Go to Date
          </label>
          <Input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="w-full"
          />
        </div>

        {/* Search */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Search Booking
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Room or agenda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>

        {/* Room Type Checkbox Filter */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Room Type
          </label>
          <div className="space-y-2">
            {[
              { key: 'small', label: 'Small Room', color: 'bg-indigo-600' },
              { key: 'medium', label: 'Medium Room', color: 'bg-amber-500' },
              { key: 'large', label: 'Large Room', color: 'bg-rose-500' },
            ].map((type) => (
              <label
                key={type.key}
                className="flex items-center space-x-3 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.key)}
                  onChange={() => handleRoomTypeToggle(type.key)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                />
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${type.color}`} />
                  {type.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar View */}
      <div className="lg:col-span-3 p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-[600px] absolute inset-0 bg-white/50 dark:bg-zinc-900/50 z-10 rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}
        
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={handleEventClick}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          height="auto"
          expandRows={true}
          handleWindowResize={true}
        />
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
                <p className="text-xs text-zinc-500 mt-1">Book an department meeting room</p>
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
