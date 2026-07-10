# Architecture — CPE Meeting Room Booking System (ISAP)

This document describes the system design using **Mermaid diagrams** (automatically rendered by GitHub when viewing `docs/architecture.md`). It serves as both architectural documentation and a script to explain the system during evaluations.

**Mapping to Grading Rubric:**
* §1 → Architecture & Tech Stack
* §2–3 → Authentication & Authorization
* §4,7 → Code Explanation & Flow
* §5 → Database design
* §6 → Code Quality
* §8 → Version Control
* §9 → Project Management

---

## 1. Overall System Architecture

```mermaid
flowchart LR
    U["User Browser"]

    subgraph Client["Frontend — Next.js Client"]
        UI["React + Tailwind + shadcn/ui"]
        TQ["TanStack Query (optional)"]
        FC["FullCalendar"]
    end

    subgraph ServerLayer["Next.js Server — App Router"]
        SA["Server Actions / Route Handlers"]
        MW["proxy.ts (session refresh)"]
    end

    subgraph Supa["Supabase (BaaS)"]
        AUTH["Supabase Auth"]
        DB[("PostgreSQL + RLS + EXCLUDE")]
        RT["Realtime"]
    end

    U --> UI
    UI --> TQ
    UI --> FC
    UI -.->|"read (RLS-protected)"| DB
    UI -->|"write"| SA
    SA --> DB
    UI -->|"login"| AUTH
    AUTH --> DB
    MW -.-> AUTH
    DB --> RT
    RT -.->|"live updates"| UI
```

**Design Rationale:**
Next.js acts as both frontend and backend (via Server Actions), eliminating the need for a separate API server. Supabase, as a Backend-as-a-Service, integrates Auth, PostgreSQL, and Realtime capabilities.
A key aspect of this design is the **separation of read and write paths**:
* **Read path (calendar views, room status):** The client reads from Supabase directly, secured by **Row Level Security (RLS)** policies at the database layer.
* **Write path (creating/cancelling bookings):** Requests go through **Server Actions** to validate data and handle business logic securely.

---

## 2. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Next.js (Server)
    participant Auth as Supabase Auth
    participant DB as PostgreSQL

    User->>NextJS: Submit email + password
    NextJS->>Auth: signInWithPassword()
    Auth->>DB: Verify user in auth.users
    DB-->>Auth: User found + Password matches
    Auth-->>NextJS: JWT + Session (stored in cookie)
    NextJS-->>User: Login successful → redirect
    Note over NextJS,Auth: proxy.ts refreshes token automatically on each request
```

**Session Management:**
Upon successful login, Supabase Auth issues a **JWT** (JSON Web Token) signed with the project's secret. This JWT is stored in cookies via `@supabase/ssr`. For subsequent requests, this JWT is automatically attached to Supabase client operations, allowing **RLS** to identify the user via `auth.uid()`.
`proxy.ts` (Next.js middleware) automatically handles refreshing the session token because Server Components cannot set cookies directly.

---

## 3. Authorization (Role-based)

```mermaid
flowchart TD
    Login["Sign In"] --> Check{"Verify role from profiles"}
    Check -->|admin| AdminDash["Admin Dashboard"]
    Check -->|user| UserDash["User Dashboard"]
    AdminDash --> MR["Manage Rooms (CRUD)"]
    AdminDash --> MB["Manage all bookings"]
    AdminDash --> AllUser["+ All User features"]
    UserDash --> Book["Book room"]
    UserDash --> MyB["My Bookings (own)"]
    UserDash --> Cal["Calendar + Status"]
```

**Privilege Differences:**
After login, the system reads the user's `role` (`user` or `admin`) from the `profiles` table.
Access control is enforced **at the database level via RLS policies**, not just hidden in the UI:
* For `bookings`, a standard user can only insert, update, or delete rows where `user_id` matches their own ID (`auth.uid() = user_id`).
* An admin (verified via the `is_admin()` SQL function) has full write privileges on all rows.
This architecture secures the system from unauthorized cross-privilege access even if client-side safety checks are bypassed.

---

## 4. Booking Flow (Conflict Prevention)

```mermaid
sequenceDiagram
    participant User
    participant SA as Next.js Server Action
    participant DB as PostgreSQL

    User->>SA: Book room (room, start, end)
    SA->>SA: Validate inputs using Zod
    SA->>DB: INSERT booking (via supabase-js)
    DB->>DB: Check EXCLUDE constraint (no overlap)
    alt Room is free (no conflict)
        DB-->>SA: Success
        SA-->>User: Booking confirmed (Green Toast)
    else Conflict — error 23P01
        DB-->>SA: exclusion_violation
        SA-->>User: Time slot already booked (Red Toast)
    end
```

**Preventing Overlapping Bookings:**
Double-booking checks are enforced at the database level using an **EXCLUDE constraint** (btree_gist + `tstzrange`). This makes the operation **atomic**, preventing race conditions when multiple users attempt to book the same room at the same millisecond.
When a conflict occurs, PostgreSQL rejects the transaction with error code `23P01`. The Server Action catches this error via a `try/catch` block and returns a clear, user-friendly message.

---

## 5. Database ER Diagram

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        text full_name
        text role
        timestamptz created_at
    }
    ROOMS {
        uuid id PK
        text name
        text room_type
        text location
        int capacity
    }
    BOOKINGS {
        uuid id PK
        uuid room_id FK
        uuid user_id FK
        text meeting_name
        timestamptz start_time
        timestamptz end_time
        text status
    }
    PROFILES ||--o{ BOOKINGS : "books (user_id)"
    ROOMS ||--o{ BOOKINGS : "has bookings (room_id)"
```

**Database Details:**
* `PROFILES.id` maps directly to Supabase's internal `auth.users.id`.
* `ROOMS.room_type` is constrained to `small | medium | large`.
* `BOOKINGS.status` is constrained to `booked | cancelled`.
* The relationship is one-to-many: one user can have multiple bookings, and one room can have multiple bookings.
* Exclude constraints are applied on the `BOOKINGS` table.

---

## 6. Directory Structure (Feature-based)

```mermaid
flowchart TD
    src["src/"] --> app["app/ — routes (App Router)"]
    src --> features["features/"]
    src --> components["components/ — shared UI"]
    src --> lib["lib/ — supabase clients, utils"]
    src --> hooks["hooks/"]
    src --> types["types/ — supabase generated types"]
    features --> auth["auth/"]
    features --> bookings["bookings/"]
    features --> rooms["rooms/"]
    features --> dashboard["dashboard/"]
```

**Code Quality and Conventions:**
We use a **feature-based structure** where files belonging to the same feature (components, server actions, schemas, types) are grouped inside `src/features/<feature_name>/`.
This keeps the code modular, readable, and scalable.
* `lib/` houses the browser and server-side Supabase client initialization.
* `types/` holds TypeScript types generated from the Supabase schema to ensure system-wide type safety.

---

## 7. Request Lifecycle

```mermaid
sequenceDiagram
    User->>Browser: Click "Book Room"
    Browser->>ServerAction: Invoke Server Action (POST)
    ServerAction->>Supabase: supabase.from('bookings').insert()
    Supabase->>Database: Execute SQL (+ RLS + constraints)
    Database-->>Supabase: data / error
    Supabase-->>ServerAction: Result
    ServerAction-->>Browser: Revalidate path + response
    Browser-->>User: Update UI + Toast notification
```

**Lifecycle Description:**
Every database write operation must flow through a Next.js Server Action rather than direct browser inserts. The database layer executes the SQL operation while checking RLS policies and constraints, returning the result to the server, which then triggers a path revalidation to update the UI on the client.

---

## 8. Git Flow

```mermaid
gitGraph
    commit
    branch develop
    checkout develop
    commit
    branch feature-auth
    commit
    checkout develop
    merge feature-auth
    branch feature-booking
    commit
    checkout develop
    merge feature-booking
    checkout main
    merge develop
```

**Branching Strategy:**
* `main` is kept stable at all times.
* `develop` is the integration branch for all completed features.
* Features are developed on separate `feature/<name>` branches.
* Commits follow the **Conventional Commits** standard (e.g. `feat:`, `fix:`, `refactor:`, `docs:`) to create a clear project history.

---

## 9. Project Timeline

```mermaid
gantt
    title ISAP — CPE Meeting Room Booking Project (1 Week)
    dateFormat YYYY-MM-DD
    section Planning
    Architecture & Setup   :done, a1, 2026-07-10, 1d
    section Development
    Authentication         :a2, after a1, 1d
    Booking & Constraint   :a3, after a2, 1d
    Calendar & My Bookings :a4, after a3, 1d
    Realtime & Admin       :a5, after a4, 1d
    section Wrap-up
    Polish & Deploy        :a6, after a5, 1d
    Test & Docs            :a7, after a6, 1d
```

**Timeline Details:**
The project is planned as a 7-day sprint: starting with architecture and setups, followed by Authentication, core Booking constraint checks, Calendar integration, Real-time status subscriptions, Admin utilities, and ending with UI polish, linting, deployment, and testing.
