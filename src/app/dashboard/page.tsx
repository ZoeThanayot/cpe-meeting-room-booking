import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardContainer } from '@/features/dashboard/components/dashboard-container'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1) Get current user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2) Fetch profile to get role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3) Fetch rooms list
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  if (error || !rooms) {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-500">
        Error loading rooms list: {error?.message || 'Unknown error'}
      </div>
    )
  }

  return (
    <DashboardContainer
      rooms={rooms}
      userEmail={user.email || ''}
      userRole={profile?.role || 'user'}
    />
  )
}
