# AI Coding Guidelines — CPE Meeting Room Booking System (ISAP)

> This file contains the coding guidelines to ensure code consistency. **Read this file before writing any code**, and follow the pattern established in `src/features/bookings/` as the standard implementation reference.

---

## 1. Project Context

Web application for booking CPE department meeting rooms. Users have 2 roles: `user` and `admin`.
Core features:
* Double-booking prevention (overlapping time slots are blocked at the database level).
* Calendar views (Day/Week/Month).
* Personal booking management (view and cancel own bookings).
* Real-time Room Status Dashboard.
* Admin panel to manage meeting rooms (CRUD) and manage all bookings.

---

## 2. Tech Stack (Strict — Do NOT Change)

| Category | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) + strict TypeScript |
| UI styling | Tailwind CSS + shadcn/ui + Lucide icons |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Backend/DB | Supabase (Auth + PostgreSQL + Realtime) |
| Authorization | Row Level Security (RLS) policies |
| Realtime | Supabase Realtime (Postgres Changes) |
| Data Fetching | TanStack Query (optional) |
| Calendar | FullCalendar React |
| Date/Time | date-fns |
| Toast Notifications | Sonner |

---

## 3. Directory Conventions (Feature-based)

* Put feature-specific code in `src/features/<feature>/` (e.g., `components/`, `actions.ts`, `schema.ts`, `queries.ts`).
* Put shared UI components in `src/components/`.
* Initialize Supabase clients only in `src/lib/supabase/`.
* File naming convention: **kebab-case** (`booking-form.tsx`), React Components: **PascalCase**, variables/functions: **camelCase**.

---

## 4. Data Model & Business Rules (Based on `supabase/schema.sql`)

* `profiles(id, full_name, role, created_at)` — where `role` is either `'user'` or `'admin'`, and `id` references `auth.users.id`.
* `rooms(id, name, room_type, location, capacity)` — where `room_type` is either `'small'`, `'medium'`, or `'large'`.
* `bookings(id, room_id, user_id, meeting_name, start_time, end_time, status, created_at)` — where `status` is either `'booked'` or `'cancelled'`.

**Important Rules:**
* Overlapping times must be blocked at the database level using an `EXCLUDE constraint`. This throws a database error code **SQLSTATE `23P01`** (exclusion violation) when a double-booking occurs.
* **Do NOT** invent columns or tables that do not exist in `schema.sql`. If database changes are needed, update `schema.sql` first.

---

## 5. Coding Patterns (Mandatory)

### 5.1 Data Reads
* Read data inside **Server Components** using the server-side Supabase client (`lib/supabase/server`).
* Use the browser client or TanStack Query only for client-side interactions (e.g., real-time subscription, interactive filtering).

### 5.2 Data Writes — via Server Actions
* All server action files must start with the `'use server'` directive.
* Flow: `validate using Zod` -> `getUser()` check -> `supabase.insert/update/delete` -> `catch errors` -> return `{ ok, error }`.
* **Never** insert or update the database directly from the browser by bypassing Server Actions.
* Reference: `src/features/bookings/actions.ts`.

### 5.3 Auth & Authorization
* Fetch current user on the server using `supabase.auth.getUser()` (never use `getSession` for security decisions).
* Enforce security using **RLS** at the database level. For admin actions, explicitly check the user's role before performing actions.
* User roles are stored in `profiles`. RLS policies can use the helper function `public.is_admin()`.

### 5.4 Real-time
* Subscribe to table changes inside Client Components: `supabase.channel(...).on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, handler).subscribe()`.
* Re-calculate room states or `invalidateQueries` (if using TanStack Query) inside the event handler.
* Clean up subscriptions inside `useEffect` cleanup return using `supabase.removeChannel(channel)`.

### 5.5 Forms
* Use React Hook Form + Zod resolver with schemas defined in `features/<feature>/schema.ts`.
* Show form errors inline. Display success or failure actions using Sonner's `toast()`.

### 5.6 Date/Time
* Always store date-times as `timestamptz` (ISO strings). Convert and display dates using `date-fns`. Keep timezone consistent (Thailand = UTC+7).

### 5.7 Types
* Use auto-generated database types from Supabase (`src/types/database.ts`). Avoid using `any`.

---

## 6. Conventions

* TypeScript `strict: true`, no `any` (use `unknown` and type narrowing instead).
* Ensure files format correctly using ESLint and Prettier before committing (refer to `.prettierrc`).
* Server Actions must return a discriminated union: `{ ok: true; data?: any } | { ok: false; error: string }`.
* Write user-facing error messages in English. Comment on non-obvious logic.
* Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`) in small, logical commits.
* Git Branching Strategy: `main` (production-ready) -> `develop` -> `feature/<name>` (e.g., `feature/booking`).

---

## 7. Security Checklist

- [ ] Row Level Security (RLS) enabled on all tables, and policies are configured.
- [ ] No `service_role` or secret keys are exposed to the client (only use `anon` key on browser).
- [ ] Zod schema input validation is executed server-side in all Server Actions.
- [ ] Profile edit forms **must not** contain a `role` field (prevents self-promotion to admin).
- [ ] Admin actions check user roles explicitly before running.

---

## 8. Definition of Done

A feature is complete when:
1. It meets the requirements.
2. It is protected by RLS.
3. Inputs are validated with Zod.
4. Database error code `23P01` is caught and handled for double-booking.
5. Loading, empty, and error states are handled.
6. The code passes linter checks.
7. Changes are committed with meaningful commit messages.

---

## 9. Do NOT

* ❌ **Do not** write data directly from browser clients (always write via Server Actions).
* ❌ **Do not** use `middleware.ts` in Next.js 16 (always use `proxy.ts`).
* ❌ **Do not** disable RLS or use `service_role` keys on the client to bypass errors.
* ❌ **Do not** guess table schemas (refer to `supabase/schema.sql`).
* ❌ **Do not** use `any` or loose casts to suppress TypeScript warnings.

---

## 10. Requirement Checklist

* **Normal User:** Sign up/Login, Book Rooms (prevent overlap), My Bookings (view, cancel own bookings), Calendar views (day/week/month + filter + search), Real-time Room Status Dashboard.
* **Admin User:** All user features, Room management (CRUD), Global booking management (cancel anyone's booking).
