'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Calendar, Clock, Video, Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type Database } from '@/types/database'
import { bookingFormSchema, type BookingFormInput } from '../schema'
import { createBooking } from '../actions'

type Room = Database['public']['Tables']['rooms']['Row']

interface BookingFormProps {
  rooms: Room[]
  initialRoomId?: string
  onSuccess?: () => void
}

// Local timezone safe date helper outside component to prevent re-creation
function getLocalDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function BookingForm({ rooms, initialRoomId = '', onSuccess }: BookingFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BookingFormInput>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      roomId: initialRoomId,
      meetingName: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
    },
  })

  // Prevent hydration mismatch by populating local date on mount
  useEffect(() => {
    setValue('date', getLocalDateString())
  }, [setValue])

  async function onSubmit(data: BookingFormInput) {
    setIsLoading(true)
    try {
      // Convert wall-clock date+time to ISO UTC here on the CLIENT — the
      // browser knows the user's timezone, while the server may run in UTC
      const result = await createBooking({
        roomId: data.roomId,
        meetingName: data.meetingName,
        startIso: new Date(`${data.date}T${data.startTime}:00`).toISOString(),
        endIso: new Date(`${data.date}T${data.endTime}:00`).toISOString(),
      })

      if (result.ok) {
        toast.success('Room booked successfully!')
        router.refresh()
        onSuccess?.()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred while booking.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset disabled={isLoading} className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="roomId"
            className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Select Meeting Room
          </label>
          <select
            id="roomId"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950 dark:border-zinc-800"
            {...register('roomId')}
          >
            <option value="" disabled className="text-zinc-500">
              -- Choose a meeting room --
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id} className="text-zinc-900 dark:text-zinc-100">
                {room.name} ({room.room_type} - Max {room.capacity} people)
              </option>
            ))}
          </select>
          {errors.roomId && (
            <p className="text-xs font-medium text-red-500 mt-1">{errors.roomId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="meetingName"
            className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Meeting Agenda / Title
          </label>
          <div className="relative">
            <Video className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id="meetingName"
              type="text"
              placeholder="e.g. Project Sync Up"
              className="pl-10"
              {...register('meetingName')}
            />
          </div>
          {errors.meetingName && (
            <p className="text-xs font-medium text-red-500 mt-1">{errors.meetingName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="date"
            className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id="date"
              type="date"
              className="pl-10"
              {...register('date')}
            />
          </div>
          {errors.date && (
            <p className="text-xs font-medium text-red-500 mt-1">{errors.date.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="startTime"
              className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Start Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                id="startTime"
                type="time"
                className="pl-10"
                {...register('startTime')}
              />
            </div>
            {errors.startTime && (
              <p className="text-xs font-medium text-red-500 mt-1">{errors.startTime.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="endTime"
              className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              End Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                id="endTime"
                type="time"
                className="pl-10"
                {...register('endTime')}
              />
            </div>
            {errors.endTime && (
              <p className="text-xs font-medium text-red-500 mt-1">{errors.endTime.message}</p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full font-semibold relative overflow-hidden group/btn bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md text-white transition-all duration-200" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reserving Room...
            </>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Confirm Booking
            </span>
          )}
        </Button>
      </fieldset>
    </form>
  )
}
