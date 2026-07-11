'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDashboard } from './calendar-dashboard'
import { RealtimeStatus } from './realtime-status'
import { MyBookings } from './my-bookings'
import { Calendar, Monitor, UserCheck, ShieldAlert, LogOut } from 'lucide-react'
import { type Database } from '@/types/database'
import { signOut } from '@/features/auth/actions'

type Room = Database['public']['Tables']['rooms']['Row']

interface DashboardContainerProps {
  initialRooms: Room[]
  userEmail: string
  userRole: string
}

export function DashboardContainer({ initialRooms, userEmail, userRole }: DashboardContainerProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'calendar' | 'status' | 'bookings'>('calendar')

  // Keep the room list live so admin room changes appear without a refresh
  const [rooms, setRooms] = useState<Room[]>(initialRooms)

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        async () => {
          const { data } = await supabase.from('rooms').select('*').order('name')
          if (data) setRooms(data)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Premium Dashboard Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-md">
              CPE
            </span>
            <span className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50 tracking-tight">
              Meeting Room Booking
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium truncate max-w-[120px] sm:max-w-none">{userEmail}</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                userRole === 'admin' 
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/60' 
                  : 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-900/60'
              }`}>
                {userRole}
              </span>
            </div>

            {userRole === 'admin' && (
              <a 
                href="/admin" 
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200/50 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Admin Panel
              </a>
            )}

            <form action={signOut}>
              <button
                type="submit"
                className="p-2 border border-zinc-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Calendar Overview
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-2 pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Monitor className="h-4 w-4" />
            Real-time Status
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'bookings'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            My Bookings
          </button>
        </div>

        {/* Tab Panel Content */}
        <div className="animate-fade-in focus:outline-none">
          {activeTab === 'calendar' && <CalendarDashboard rooms={rooms} />}
          {activeTab === 'status' && <RealtimeStatus rooms={rooms} />}
          {activeTab === 'bookings' && <MyBookings rooms={rooms} />}
        </div>
      </div>
    </div>
  )
}
