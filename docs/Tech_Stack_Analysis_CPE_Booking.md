# Tech Stack: Next.js + Supabase + Learning Plan + Task Breakdown
## Project: CPE Meeting Room Booking System (SE Exam – ISAP)

This document provides a summary of the selected tech stack, implementation rationale, and learning resources.

---

## 0. Project Summary

| User Group | Requirements |
|---|---|
| **Normal User** | Login, Book room (prevent conflicts), View/Edit/Delete own bookings, Calendar (day/week/month view), View real-time room statuses |
| **Admin User** | All Normal User features + Manage **all** bookings + Add/Edit/Delete **meeting rooms** |

**Grading Rubrics (100 Points):** Project Mgmt (10), Architecture & Tech Stack (10), Auth & Authorization (10), Version Control (10), Code Explanation & Flow (20), Code Quality (20), As per Requirement (20).

---

## 1. Selected Tech Stack & Rationale (Architecture - 10 Points)

| Layer | Selection | Rationale |
|---|---|---|
| **Frontend + Backend** | **Next.js 16 (App Router)** | Full-stack architecture: React on frontend, Route Handlers / Server Actions on backend. Strict type-safety with TypeScript. |
| **Authentication** | **Supabase Auth** | Ready-to-use email/password authentication, session management, and JWT integration. |
| **Authorization (roles)** | **`profiles` table (role) + Row Level Security (RLS)** | Secures data directly at the database layer, completely preventing cross-privilege access. |
| **Database** | **Supabase Postgres** | Relational database supporting schema constraints and transactions. |
| **Real-time Updates** | **Supabase Realtime** (`postgres_changes`) | Live updates for room statuses on the dashboard without polling. |
| **Conflict Prevention** | **Postgres EXCLUDE constraint** (btree_gist) | Atomically prevents double-bookings for the same room at the database level. |
| **Calendar UI** | **FullCalendar React** (`@fullcalendar/react`) | Interactive calendar UI supporting day/week/month views. |
| **Styling** | **Tailwind CSS** (+ shadcn/ui) | Utility-first CSS library for responsive, premium designs. |
| **Deployment** | **Vercel** (frontend) + **Supabase Cloud** | One-click deployment with automatic environment configurations. |
| **Version Control** | **Git + GitHub** | Required for source control and collaboration. |

---

## 2. System Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     Browser (Client)                       │
│  Next.js Client Components + Tailwind + FullCalendar        │
│  • supabase-js (createBrowserClient)                        │
│  • Realtime subscription → Live room status dashboard       │
│  • Direct reads secured by database RLS                     │
└───────────────┬───────────────────────────────────────────┘
                │  (Read paths: client → Supabase direct)
                │  (Write paths: client → Server Action)
                ▼
┌───────────────────────────────────────────────────────────┐
│                  Next.js Server (App Router)               │
│  • Server Components / Route Handlers / Server Actions      │
│  • supabase server client (createServerClient)             │
│  • Create/Manage bookings and handle database constraints   │
│  • proxy.ts (middleware) automatically refreshes session    │
└───────────────┬───────────────────────────────────────────┘
                │  supabase-js
                ▼
┌───────────────────────────────────────────────────────────┐
│                        Supabase                            │
│  Auth (login/JWT)  |  Postgres + RLS  |  Realtime           │
│  Tables: profiles, rooms, bookings                         │
│  EXCLUDE constraint blocks double-bookings atomically       │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Auth & Authorization (10 Points)

* **Authentication:** Handled by Supabase Auth (Email + Password). It handles password hashing, sessions, and JWT tokens automatically.
* **Role Separation:** A `profiles` table maps to `auth.users`, assigning `role` as either `'user'` or `'admin'`.
* **Row Level Security (RLS) Policies:**
  * `rooms`: Read accessible to all authenticated users. Writes (Insert/Update/Delete) restricted to `admin` role.
  * `bookings`: Read accessible to all authenticated users. Writes restricted to owners (`auth.uid() = user_id`) or `admin`.

---

## 4. Double-Booking Prevention (Exclusion Constraint)

We enforce double-booking prevention at the Postgres database level using an exclusion constraint:
```sql
create extension if not exists btree_gist;

alter table bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status = 'booked');
```
When an overlap is detected, Postgres throws SQLSTATE `23P01`. Next.js Server Actions catch this error and return a friendly validation message back to the client UI.

---

## 5. Real-time Room Status

1. Enable Realtime changes on the `bookings` table in Supabase.
2. In the Client Component dashboard, subscribe to `postgres_changes` on the `bookings` table.
3. On insert/delete events, re-calculate and update room statuses (Total, Available, Occupied) instantly without page refreshes.

---

## 6. 7-Day Implementation Schedule

| Day | Focus | Milestone |
|---|---|---|
| **Day 1** | Supabase Setup & Schema Integration | Supabase project online, schema and seeds run, typescript types generated. |
| **Day 2** | Auth & Route Protection | Login/Signup pages working, role-based checks, `proxy.ts` middleware working. |
| **Day 3** | Server Actions & Conflict Check | Booking action with database constraint handling implemented. |
| **Day 4** | Calendar Dashboard & User Bookings | FullCalendar UI integrated, personal booking management page complete. |
| **Day 5** | Real-time Updates & RLS Policies | Live dashboard status working, RLS rules finalized and tested. |
| **Day 6** | Admin Dashboard & Polish | Room CRUD features for Admin working, Tailwind styling and responsive layout check. |
| **Day 7** | Version Control & Flow Review | Commit history check, walkthrough files updated, and end-to-end flow test. |

---

## 7. Version Control Strategy (10 Points)

* **Branches:** `main` (production-ready) -> `develop` (integration) -> `feature/*` (feature branches).
* **Commit Messages:** Follow Conventional Commits format (e.g. `feat: add booking action with conflict checks`).
