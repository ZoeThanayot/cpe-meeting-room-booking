import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminContainer } from '@/features/admin/components/admin-container'

export default async function AdminPage() {
  const supabase = await createClient()

  // 1) Verify user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2) Verify user is an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // 3) Fetch initial rooms
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  if (error || !rooms) {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-500">
        Error loading admin rooms: {error?.message || 'Unknown error'}
      </div>
    )
  }

  return <AdminContainer initialRooms={rooms} />
}
