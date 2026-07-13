# CPE Meeting Room Booking — Starter

- 🚀 Live URL (Vercel)
  **https://cpe-meeting-room-booking.vercel.app

- 🚀 notion book
  **https://app.notion.com/p/CPE-SE-Exam-ISAP-39916116748381d287a5f2ec3826a1e5?source=copy_link

Starter project for **Next.js 16 + Supabase**, featuring the correct authentication integration using the latest standards (`proxy.ts` + `@supabase/ssr` + publishable key).

> This folder is designed to contain **only the files that `create-next-app` cannot generate automatically** (Supabase setup, folder structure, database schema, and developer guidelines) to ensure configurations/versions do not become outdated.

---

## Getting Started (One-time Setup)

We have already completed the Next.js boilerplate setup and dependency installation:

1. **Next.js Project Creation:** Initialized using standard App Router, TypeScript, Tailwind CSS, and `src/` directory configurations.
2. **Dependencies Installed:**
   - `@supabase/supabase-js`, `@supabase/ssr`
   - `zod`, `react-hook-form`, `@hookform/resolvers`
   - `@tanstack/react-query`
   - FullCalendar packages (`@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`)
   - `date-fns`, `sonner`, `lucide-react`, `clsx`, `tailwind-merge`
   - `prettier`, `prettier-plugin-tailwindcss` (devDependencies)
3. **shadcn/ui Initialized:** Added `button`, `input`, `form`, and `sonner` toast components.

---

## Remaining Setup Instructions

To run the application locally, follow these steps:

1. **Environment Configuration:**
   Copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

   Open `.env.local` and fill in your Supabase project URL and Publishable Key.

2. **Database Setup:**
   - Open your Supabase Dashboard.
   - Go to **SQL Editor** -> **New query**.
   - Copy the contents of `supabase/schema.sql` and run it to set up the tables, Row Level Security (RLS) policies, and triggers.

3. **Generate TypeScript Types (Recommended):**
   Generate exact database types using Supabase CLI:

   ```bash
   npx supabase gen types typescript --project-id <PROJECT_REF> > src/types/database.ts
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

---

## Folder Structure (Feature-based)

The project organizes code by functional features to ensure scaling and maintainability:

```
src/
  app/                 # App Router routes and page layouts
  proxy.ts             # Next.js 16 middleware (session token refresh & route protection)
  lib/
    supabase/
      client.ts        # Browser-side Supabase client (Client Components)
      server.ts        # Server-side Supabase client (RSC / Server Actions)
      middleware.ts    # Session updates invoked by proxy.ts
    utils.ts           # Utility helper function cn() for tailwind-merge
  features/
    auth/              # Login / Signup / Logout components and logic
    bookings/          # Core booking features (includes action.ts and schema.ts patterns)
    rooms/             # Admin room management CRUD operations
    dashboard/         # Calendar dashboard and real-time room statuses
  components/          # Shared reusable UI components
  hooks/               # Custom React hooks
  types/database.ts    # TypeScript types generated from Supabase
supabase/
  schema.sql           # Database schema, RLS policies, and triggers
AI_GUIDELINES.md       # Guidelines for AI coding agents to maintain style consistency
```

## Next Steps

Read the [AI_GUIDELINES.md](file:///Users/thanayot/Downloads/cpe-booking-starter/AI_GUIDELINES.md) file and begin implementing the features incrementally. Follow the patterns shown in `src/features/bookings/` as your reference.
