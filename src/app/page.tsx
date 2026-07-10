import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/features/auth/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { User, LogOut, Shield, CalendarDays } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()

  // 1) Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2) Get user profile for roles (fallback to user if profile not found yet)
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <main className="w-full max-w-lg p-8 bg-white border border-zinc-200 rounded-2xl shadow-xl dark:bg-zinc-900 dark:border-zinc-800 space-y-8">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl">
            <CalendarDays className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            CPE Room Booking
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Secure, overlapping-free meeting room reservation system
          </p>
        </div>

        {user ? (
          <div className="space-y-6">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center space-x-3 text-zinc-700 dark:text-zinc-300">
                <User className="h-5 w-5 text-zinc-400" />
                <span className="font-semibold text-sm">Logged in as:</span>
                <span className="text-sm font-mono truncate">{user.email}</span>
              </div>
              
              {profile && (
                <>
                  <div className="flex items-center space-x-3 text-zinc-700 dark:text-zinc-300">
                    <Shield className="h-5 w-5 text-zinc-400" />
                    <span className="font-semibold text-sm">Role:</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      profile.role === 'admin' 
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                        : 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                    }`}>
                      {profile.role}
                    </span>
                  </div>
                  {profile.full_name && (
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 pl-8">
                      Name: {profile.full_name}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'flex-1 font-semibold text-center flex items-center justify-center'
                )}
              >
                Go to Dashboard
              </a>
              
              <form action={signOut} className="flex-1">
                <Button type="submit" variant="outline" className="w-full font-semibold border-zinc-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:hover:bg-rose-950/30 dark:hover:text-rose-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Please sign in or create an account to start booking meeting rooms.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'flex-1 font-semibold text-center flex items-center justify-center'
                )}
              >
                Sign In
              </a>
              <a
                href="/signup"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'flex-1 font-semibold text-center flex items-center justify-center border-zinc-200 dark:border-zinc-800'
                )}
              >
                Sign Up
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
