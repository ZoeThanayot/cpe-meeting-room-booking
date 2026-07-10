-- =====================================================================
-- CPE Meeting Room Booking — Day 1 Database Setup (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Usage: Supabase Dashboard → SQL Editor → New query → Paste all → Run
-- This file is safe to run repeatedly (idempotent) as it uses IF NOT EXISTS / DROP ... IF EXISTS
-- Designed for a fresh database project
-- =====================================================================


-- 1) EXTENSIONS --------------------------------------------------------
-- btree_gist is required for EXCLUDE constraint (allows combining = on uuid with && on time ranges)
create extension if not exists btree_gist;


-- 2) TABLES ------------------------------------------------------------

-- 2.1 profiles: User profiles and roles linked to Supabase auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- 2.2 rooms: Meeting rooms
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  room_type  text not null check (room_type in ('small','medium','large')),
  location   text,
  capacity   int,
  created_at timestamptz not null default now()
);

-- 2.3 bookings: Bookings
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id)     on delete cascade,
  user_id      uuid not null references auth.users(id)       on delete cascade,
  meeting_name text not null,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  status       text not null default 'booked' check (status in ('booked','cancelled')),
  created_at   timestamptz not null default now(),
  -- Start time must always be before end time
  constraint valid_time_range check (end_time > start_time)
);


-- 3) DOUBLE-BOOKING PREVENTION (Core requirement) --------------------
-- Prevent overlapping bookings for the same room (only for active 'booked' bookings)
-- Enforced at the DB level to atomically prevent race conditions
alter table public.bookings drop constraint if exists no_overlapping_bookings;
alter table public.bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status = 'booked');


-- 4) INDEXES -----------------------------------------------------------
create index if not exists idx_bookings_room_time on public.bookings (room_id, start_time);
create index if not exists idx_bookings_user      on public.bookings (user_id);

-- Enable full replica identity for Realtime DELETE events to send previous values (know which room became free)
alter table public.bookings replica identity full;


-- 5) HELPER FUNCTION: is_admin() -------------------------------------
-- Uses security definer to avoid infinite recursion when checking roles from within policies
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- 6) TRIGGER: Automatically create profile on new user signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 7) ENABLE ROW LEVEL SECURITY -----------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms    enable row level security;
alter table public.bookings enable row level security;


-- 8) RLS POLICIES ------------------------------------------------------
-- Use (select auth.uid()) to allow Postgres to cache the value for faster execution

-- 8.1 profiles: Anyone authenticated can select, users can only update their own profile
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select using ((select auth.uid()) is not null);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using  ((select auth.uid()) = id)
              with check ((select auth.uid()) = id);
-- ⚠️ Prevent users from self-promoting to admin: Do not include the 'role' field in user-facing update forms
--    (For stricter security, column privilege or triggers can be used to ensure 'role' is not updated)

-- 8.2 rooms: Anyone authenticated can select, only admin can write (insert/update/delete)
drop policy if exists rooms_select_authenticated on public.rooms;
create policy rooms_select_authenticated on public.rooms
  for select using ((select auth.uid()) is not null);

drop policy if exists rooms_admin_write on public.rooms;
create policy rooms_admin_write on public.rooms
  for all using (public.is_admin()) with check (public.is_admin());

-- 8.3 bookings: Anyone authenticated can select (to view availability/calendar)
--               Insert/Update/Delete = Booking owner or admin
drop policy if exists bookings_select_authenticated on public.bookings;
create policy bookings_select_authenticated on public.bookings
  for select using ((select auth.uid()) is not null);

drop policy if exists bookings_insert_own_or_admin on public.bookings;
create policy bookings_insert_own_or_admin on public.bookings
  for insert with check ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists bookings_update_own_or_admin on public.bookings;
create policy bookings_update_own_or_admin on public.bookings
  for update using  ((select auth.uid()) = user_id or public.is_admin())
              with check ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists bookings_delete_own_or_admin on public.bookings;
create policy bookings_delete_own_or_admin on public.bookings
  for delete using ((select auth.uid()) = user_id or public.is_admin());


-- 9) ENABLE REALTIME FOR BOOKINGS TABLE (for room status dashboard) ----
do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null; -- already exists, ignore
end $$;


-- 10) SEED MEETING ROOMS (Based on wireframe: 10 rooms) -----------------
insert into public.rooms (name, room_type, location, capacity) values
  ('Small Room 1',  'small',  'Floor 1', 4),
  ('Small Room 2',  'small',  'Floor 1', 4),
  ('Small Room 3',  'small',  'Floor 1', 4),
  ('Small Room 4',  'small',  'Floor 1', 4),
  ('Medium Room 1', 'medium', 'Floor 2', 8),
  ('Medium Room 2', 'medium', 'Floor 2', 8),
  ('Medium Room 3', 'medium', 'Floor 2', 8),
  ('Large Room 1',  'large',  'Floor 3', 20),
  ('Large Room 2',  'large',  'Floor 3', 20),
  ('Large Room 3',  'large',  'Floor 3', 20)
on conflict (name) do nothing;


-- 11) HOW TO PROMPT A USER TO ADMIN (Run after user registers in the app)
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'you@example.com');

-- =====================================================================
-- End of Day 1! Next step: Configure Supabase client (@supabase/ssr) in Next.js
--   Then test user signup/login and query rooms.
-- =====================================================================
