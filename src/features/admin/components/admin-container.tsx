'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { type Database } from '@/types/database'
import { createRoom, updateRoom, deleteRoom } from '../actions'
import { cancelBooking } from '@/features/bookings/actions'
import { createRoomSchema, type CreateRoomInput } from '../schema'
import {
  Building,
  Trash2,
  Plus,
  Pencil,
  Loader2,
  MapPin,
  Users,
  Calendar,
  ShieldAlert,
  ArrowLeft,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Room = Database['public']['Tables']['rooms']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']
interface Profile {
  id: string
  full_name: string | null
}

interface AdminContainerProps {
  initialRooms: Room[]
}

export function AdminContainer({ initialRooms }: AdminContainerProps) {
  const router = useRouter()
  const supabase = createClient()

  // Tabs
  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings'>('rooms')

  // Realtime state
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Loaders
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Room currently being edited — null means the form is in "add" mode
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  // Add Room Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      roomType: 'small',
      capacity: 10,
      location: '',
    },
  })

  // Fetch Rooms
  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('name')
    if (data) setRooms(data)
  }

  // Fetch Bookings & Profiles — `loadingBookings` starts true; realtime
  // refetches update the table silently without flashing the spinner
  const fetchData = async () => {
    try {
      const [bookingsRes, profilesRes] = await Promise.all([
        supabase.from('bookings').select('*').order('start_time', { ascending: false }),
        supabase.from('profiles').select('id, full_name'),
      ])

      if (bookingsRes.data) setBookings(bookingsRes.data)
      if (profilesRes.data) setProfiles(profilesRes.data)
    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoadingBookings(false)
    }
  }

  // Initial load and subscriptions
  useEffect(() => {
    // Initial data load on mount — state updates happen after await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()

    // Realtime subscriptions
    const roomsChannel = supabase
      .channel('admin-rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
      })
      .subscribe()

    const bookingsChannel = supabase
      .channel('admin-bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(roomsChannel)
      supabase.removeChannel(bookingsChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switch form into edit mode, pre-filled with the room's current values
  function startEditRoom(room: Room) {
    setEditingRoom(room)
    reset({
      name: room.name,
      roomType: room.room_type,
      capacity: room.capacity ?? 1,
      location: room.location ?? '',
    })
  }

  // Back to "add" mode with a clean form
  function cancelEdit() {
    setEditingRoom(null)
    reset({ name: '', roomType: 'small', capacity: 10, location: '' })
  }

  // Action: Add or Update Room (form is shared between both modes)
  async function onSubmitRoom(data: CreateRoomInput) {
    setActionLoading('save-room')
    try {
      const result = editingRoom
        ? await updateRoom({ id: editingRoom.id, ...data })
        : await createRoom(data)

      if (result.ok) {
        toast.success(editingRoom ? 'Room updated successfully!' : 'Room created successfully!')
        cancelEdit()
        fetchRooms()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Delete Room
  async function onDeleteRoom(roomId: string) {
    if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) return
    setActionLoading(roomId)
    try {
      const result = await deleteRoom(roomId)
      if (result.ok) {
        toast.success('Room deleted successfully!')
        // Leave edit mode if the room being edited was just deleted
        if (editingRoom?.id === roomId) cancelEdit()
        fetchRooms()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Force Cancel Booking
  async function onForceCancelBooking(bookingId: string) {
    if (!confirm('Are you sure you want to FORCE CANCEL this booking?')) return
    setActionLoading(bookingId)
    try {
      const result = await cancelBooking(bookingId)
      if (result.ok) {
        toast.success('Booking cancelled successfully!')
        fetchData()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const getUserName = (userId: string) => {
    return profiles.find((p) => p.id === userId)?.full_name || 'Anonymous User'
  }

  const getRoomName = (roomId: string) => {
    return rooms.find((r) => r.id === roomId)?.name || 'Unknown Room'
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <span className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50 tracking-tight">
                Admin Control Panel
              </span>
            </div>
          </div>
          <span className="text-[10px] font-extrabold tracking-wider bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 border border-rose-250 dark:border-rose-900/60 px-3 py-1 rounded-full uppercase">
            System Administrator
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rooms'
                ? 'border-rose-600 text-rose-600 dark:border-rose-450 dark:text-rose-450'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Building className="h-4 w-4" />
            Room Management
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'bookings'
                ? 'border-rose-600 text-rose-600 dark:border-rose-450 dark:text-rose-450'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Booking Management
          </button>
        </div>

        {/* Tab Panel Content */}
        <div className="animate-fade-in">
          {activeTab === 'rooms' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel: Rooms list */}
              <div className="lg:col-span-2 p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Active Rooms</h3>
                  <p className="text-xs text-zinc-550 mt-0.5">Manage existing department meeting rooms</p>
                </div>

                <div className="divide-y divide-zinc-150 dark:divide-zinc-800/60 max-h-[500px] overflow-y-auto pr-1">
                  {rooms.map((room) => {
                    const isDeleting = actionLoading === room.id

                    return (
                      <div
                        key={room.id}
                        className="flex items-center justify-between py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 px-2 rounded-xl transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-655 dark:text-zinc-400">
                            <Building className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-zinc-805 dark:text-zinc-200">
                              {room.name}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Max {room.capacity}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {room.location || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {room.room_type}
                          </span>

                          <button
                            onClick={() => startEditRoom(room)}
                            title="Edit room"
                            className={`p-2 border rounded-lg transition-colors cursor-pointer ${
                              editingRoom?.id === room.id
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400'
                                : 'border-zinc-200 dark:border-zinc-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
                            }`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => onDeleteRoom(room.id)}
                            disabled={isDeleting}
                            title="Delete room"
                            className="p-2 border border-zinc-200 dark:border-zinc-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Panel: Add / Edit Room Form */}
              <div className="lg:col-span-1 p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl h-fit space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {editingRoom ? 'Edit Room' : 'Add New Room'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {editingRoom
                      ? `Editing "${editingRoom.name}"`
                      : 'Create a new reservation room'}
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmitRoom)}>
                  <fieldset disabled={actionLoading === 'save-room'} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Room Name
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Smart Room 4"
                        {...register('name')}
                      />
                      {errors.name && (
                        <p className="text-xs font-medium text-red-500 mt-1">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Room Type
                      </label>
                      <select
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950 dark:border-zinc-800"
                        {...register('roomType')}
                      >
                        <option value="small">Small Room</option>
                        <option value="medium">Medium Room</option>
                        <option value="large">Large Room</option>
                      </select>
                      {errors.roomType && (
                        <p className="text-xs font-medium text-red-500 mt-1">{errors.roomType.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Max Capacity
                      </label>
                      <Input
                        type="number"
                        placeholder="10"
                        {...register('capacity', { valueAsNumber: true })}
                      />
                      {errors.capacity && (
                        <p className="text-xs font-medium text-red-500 mt-1">{errors.capacity.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Location / Floor
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 4th floor, Eng building"
                        {...register('location')}
                      />
                      {errors.location && (
                        <p className="text-xs font-medium text-red-500 mt-1">{errors.location.message}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center justify-center gap-2 mt-2"
                    >
                      {actionLoading === 'save-room' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {editingRoom ? 'Saving Changes...' : 'Creating Room...'}
                        </>
                      ) : editingRoom ? (
                        <>
                          <Pencil className="h-4 w-4" />
                          Save Changes
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add Room
                        </>
                      )}
                    </Button>

                    {editingRoom && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelEdit}
                        className="w-full font-semibold border-zinc-200 dark:border-zinc-800"
                      >
                        Cancel Editing
                      </Button>
                    )}
                  </fieldset>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">All Reservations</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Cancel or monitor any user reservations in the system</p>
              </div>

              {loadingBookings ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-rose-600" />
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-center py-20 text-sm text-zinc-400 italic">No bookings found in the database.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-150 dark:border-zinc-800 pb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                        <th className="py-3 px-4">Agenda / Title</th>
                        <th className="py-3 px-4">Room</th>
                        <th className="py-3 px-4">User Name</th>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/60 text-sm">
                      {bookings.map((booking) => {
                        const isCancelled = booking.status === 'cancelled'
                        const isActionLoading = actionLoading === booking.id
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
                            <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300">
                              {getRoomName(booking.room_id)}
                            </td>
                            <td className="py-4 px-4 font-medium text-zinc-650 dark:text-zinc-400">
                              {getUserName(booking.user_id)}
                            </td>
                            <td className="py-4 px-4 text-zinc-500">
                              {format(start, 'dd MMM yyyy')} · {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                            </td>
                            <td className="py-4 px-4">
                              <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                                isCancelled 
                                  ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' 
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-455'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {!isCancelled && (
                                <button
                                  onClick={() => onForceCancelBooking(booking.id)}
                                  disabled={isActionLoading}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5" />
                                  )}
                                  Force Cancel
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
          )}
        </div>
      </div>
    </div>
  )
}
