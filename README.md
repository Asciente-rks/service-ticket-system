# Service Ticket System

> Internal IT/QA ticketing platform with a built-in approval workflow — testers report defects, developers fix them, admins triage, and approvers sign them off before tickets close.

A four-role ticket workflow (`SUPER_ADMIN`, `ADMIN`, `TESTER`, `DEVELOPER`) with six lifecycle statuses, per-ticket approval/rejection, granular per-user notification settings, and node-cron-driven SLA housekeeping. Backend is Express + Sequelize + MySQL; frontend is React 19 + Vite + Tailwind 4. Deployed on free tiers — Vercel for the SPA, host-agnostic Node service for the API.

The system spans **two repositories**:

| Repository | What it is | Stack |
|---|---|---|
| [`service-ticket-system`](https://github.com/Asciente-rks/service-ticket-system) | REST API backend | Express 4 + Sequelize + MySQL + node-cron |
| [`service-ticket-system-frontend`](https://github.com/Asciente-rks/service-ticket-system-frontend) | Web client (SPA) | React 19 + Vite + Tailwind 4 |

---

## Live Demo

- **🌐 Live app:** [service-ticket-system-frontend.vercel.app](https://service-ticket-system-frontend.vercel.app)

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Database Design](#database-design)
5. [Repository Layout](#repository-layout)
6. [API Reference](#api-reference)
7. [Authentication & Credentials](#authentication--credentials)
8. [Deployment](#deployment)
9. [Cost Breakdown](#cost-breakdown)
10. [Local Development](#local-development)
11. [Author](#author)

---

## What It Does

- **Report tickets** with title, description, priority, optional initial assignment.
- **Assign and re-assign** tickets between developers and admins.
- **Track six statuses** through the lifecycle: `OPEN → IN_PROGRESS → READY_FOR_QA → ERROR_PERSISTS / RESOLVED → CLOSED`.
- **Approval workflow** — once a ticket is `READY_FOR_QA`, an approver issues `Approved` (with optional comment) to move it to `RESOLVED`, or `Rejected` to bounce it back.
- **In-app notifications** with per-user read flag and granular toggles for which events fire.
- **Profile + settings** pages let users update their account and notification preferences.
- **Role-scoped UI** — admins see user management, testers see reported tickets, developers see assignments, super-admins see everything.
- **Cron-driven housekeeping** — `node-cron` jobs run on the backend (`initCronJobs`) for SLA reminders / stale-ticket processing.

---

## Architecture

```
┌─────────────────────────────┐
│ Browser (React 19 + Vite)   │
│  • Vercel-hosted SPA        │
│  • react-router 7           │
│  • Tailwind 4               │
│  • jwt-decode for client    │
│    role parsing             │
└───────────┬─────────────────┘
            │ REST + JWT (Bearer)
            │ axios
            │
            ▼
┌─────────────────────────────┐
│ Express 4 API               │
│  • helmet + CORS            │
│  • express.json             │
│  • route mounts:            │
│    /auth /users /tickets    │
│    /notifications           │
│  • /health liveness         │
└───────────┬─────────────────┘
            │ Sequelize 6 ORM
            │
            ▼
       ┌──────────────┐         ┌──────────────────────┐
       │ MySQL        │  ◄────  │ node-cron            │
       │  (free-tier  │         │  • SLA reminders     │
       │   hosted)    │         │  • stale-ticket scan │
       │              │         │  (initCronJobs)      │
       └──────────────┘         └──────────────────────┘
```

**Notable architectural choices:**

- **Single Express process** — no queue, no worker. `helmet`, `cors`, `express.json`, route mounts, `/health` probe. On startup: `connectDB()` → `defineAssociations()` → `initCronJobs()` → listen.
- **Cron co-located with the API** — saves an additional service. node-cron fires inside the same Node process; the trade-off is that scaling horizontally requires either a leader-election strategy or moving cron to a dedicated worker.
- **Modular DDD-ish layout** — each domain (tickets, users, notifications) has its own `controllers/services/repositories/dtos/models/routes`. New domains drop in with a familiar shape.
- **Snake_case DB columns** mapped to camelCase model attributes via Sequelize `field` — clean SQL audit trail, idiomatic JS code.

---

## Tech Stack

### Backend (`service-ticket-system`)

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js + TypeScript 5 | Standard, widely deployable |
| HTTP | Express 4 | Stable, familiar |
| Security | `helmet` + `cors` | Sane defaults for headers + CORS |
| ORM | Sequelize 6 | Models + associations + migrations in one |
| Database | **MySQL** via `mysql2` | Free-tier providers abundant (Aiven, FreeSQLDatabase) |
| Auth | JWT (`jsonwebtoken`) + **bcryptjs** | bcrypt's pure-JS sibling — no native build step |
| Validation | Yup | Tiny, ergonomic |
| Scheduled jobs | **node-cron** | In-process scheduler — saves a worker service |
| Dev | nodemon (`ts-node` watch) | Auto-restart on save |
| Bootstrap | `postinstall` runs `npm run build` | Render-friendly — no build step in start command |

### Frontend (`service-ticket-system-frontend`)

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 19 + TypeScript 5 | Latest, concurrent features |
| Build | Vite 8 | Sub-second HMR |
| Styling | **Tailwind CSS 4** + ThemeProvider | Latest engine, dark/light tokens |
| Routing | react-router-dom 7 | Latest API |
| HTTP | axios | Interceptors for JWT injection |
| Auth | `jwt-decode` | Parse JWT client-side for role-aware UI |
| Icons | `lucide-react` | Consistent, tree-shakable |
| Lint | ESLint 9 + typescript-eslint | Modern config |
| Hosting | **Vercel** | Hobby tier free, auto-deploys |

---

## Database Design

Seven Sequelize models. All primary keys are UUID v4. **DB columns are snake_case** (`reported_by`, `assigned_to`, `status_id`); model attributes are camelCase, mapped via Sequelize `field`.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | UUIDv4 |
| `role_id` | UUID (FK → roles.id) | not null |
| `name` | VARCHAR | display name |
| `email` | VARCHAR | unique, login key |
| `password` | VARCHAR | bcryptjs hash |
| `created_at` / `updated_at` | DATETIME | timestamps |

### `roles`

Four roles seeded with **hardcoded UUIDs** in `src/config/roles.ts` (so seeders and code agree across environments).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | hardcoded per role |
| `name` | VARCHAR | unique, one of `SUPER_ADMIN`, `ADMIN`, `TESTER`, `DEVELOPER` |

### `tickets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `title` | VARCHAR | not null |
| `description` | TEXT | |
| `reported_by` | UUID (FK → users.id) | not null |
| `assigned_to` | UUID (FK → users.id) | nullable |
| `status_id` | UUID (FK → ticket_statuses.id) | not null |
| `priority` | VARCHAR | free-form (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |

### `ticket_statuses`

Six statuses seeded with **hardcoded UUIDs** in `src/config/statuses.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | hardcoded |
| `name` | VARCHAR | unique, one of `OPEN`, `IN_PROGRESS`, `READY_FOR_QA`, `ERROR_PERSISTS`, `RESOLVED`, `CLOSED` |

### `approvals`

Per-decision audit row — multiple approvals over a ticket's lifetime are preserved.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `ticket_id` | UUID (FK → tickets.id) | not null |
| `approver_id` | UUID (FK → users.id) | not null |
| `status` | ENUM | `'Approved' \| 'Rejected'` |
| `comment` | TEXT | optional, becomes part of audit trail |
| `approved_at` | DATETIME | default NOW |

### `notifications`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → users.id) | not null, recipient |
| `message` | VARCHAR | not null |
| `read` | BOOLEAN | default false |
| `ticket_id` | UUID (FK → tickets.id) | nullable, optional context |

### `notification_settings`

1:1 with users. Defaults all `true` — auto-created for new users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → users.id) | not null |
| `notify_assigned_ticket` | BOOLEAN | default true |
| `notify_reported_ticket_updated` | BOOLEAN | default true |
| `notify_ticket_approved` | BOOLEAN | default true |
| `notify_ticket_rejected` | BOOLEAN | default true |

**Notable design choices:**

- **Hardcoded role + status UUIDs** in `src/config/{roles,statuses}.ts` — seeders and code agree across environments. No need to look up the role ID at runtime.
  ```typescript
  // roles.ts
  SUPER_ADMIN: 'c3b538f5-8c72-48e2-b268-6a1359a62fe7'
  ADMIN:       '0927eb32-25c8-4819-bddd-c8e9c6c1dfaf'
  TESTER:      'bbf4184d-92c3-4a90-bbb2-de33c6c38a29'
  DEVELOPER:   '668f4898-47ae-4da3-a1a5-fe8eb34a7f82'

  // statuses.ts
  OPEN, IN_PROGRESS, READY_FOR_QA,
  ERROR_PERSISTS, RESOLVED, CLOSED
  ```
- **Two FKs from `tickets` to `users`** — one for the reporter (`reported_by`), one for the assignee (`assigned_to`), with named Sequelize aliases (`reporter` / `assignee`).
- **Approvals are per-decision audit rows**, not a state column — multiple approvals over a ticket's lifetime preserved.
- **bcryptjs instead of bcrypt** — no native build step, deploys cleanly on Render/Railway/Vercel serverless functions.

---

## Repository Layout

### Backend

```
service-ticket-system/
├── package.json                      # build, db:sync, seed:roles/status/users, db:reset
├── tsconfig.json
└── src/
    ├── server.ts                     # Express bootstrap + route mounts + cron init
    ├── associations/
    │   └── associations.ts           # All Sequelize relations in one place
    ├── config/
    │   ├── db.ts                     # Sequelize connection
    │   ├── roles.ts                  # Hardcoded role UUIDs
    │   └── statuses.ts               # Hardcoded ticket-status UUIDs
    ├── middlewares/
    │   ├── auth.middleware.ts        # JWT verification
    │   ├── permissions.middleware.ts # Per-route permission gates
    │   ├── role.utils.ts
    │   └── validator.middleware.ts   # yup schema runner
    ├── modules/
    │   ├── tickets/                  # Modular: controllers, services,
    │   │   │                         # repositories, dtos, models, routes, cron
    │   │   ├── controllers/  …       # create, get, list, update, fetch-status,
    │   │   │                         # approval
    │   │   ├── services/     …       # ticket.service.ts (10KB), approval.service.ts
    │   │   ├── repositories/  …
    │   │   ├── dtos/  …
    │   │   ├── models/   …           # ticket, ticket-status, approval
    │   │   ├── routes/   …
    │   │   └── cron/ticket.cron.ts   # SLA / stale-ticket housekeeping
    │   ├── users/                    # Same modular pattern for users + auth
    │   │   ├── controllers/   …      # auth (login), CRUD, role fetching,
    │   │   │                         # notification settings
    │   │   ├── services/   …         # auth.service, user.service,
    │   │   │                         # notification-setting.service
    │   │   ├── repositories/  …
    │   │   ├── dtos/  …
    │   │   ├── models/  …            # user, role, notification-settings
    │   │   └── routes/  …            # auth.routes, user.routes,
    │   │                             # notification-settings.routes
    │   └── notifications/            # Listing + creation
    │       ├── controllers/list-notifications.controller.ts
    │       ├── services/notification.service.ts
    │       ├── repositories/notification.repository.ts
    │       ├── dtos/  …
    │       ├── models/notification.model.ts
    │       └── routes/notification.routes.ts
    ├── scripts/
    │   ├── sync-db.ts                # sequelize.sync() helper
    │   ├── seed-roles.ts
    │   ├── seed-ticket-status.ts
    │   └── seed-users.ts
    └── utils/
        ├── notification.validation.ts
        ├── ticket.validation.ts
        └── user.validation.ts
```

### Frontend

```
service-ticket-system-frontend/
├── package.json                       # React 19, Vite 8, Tailwind 4
├── eslint.config.js
├── vite.config.ts
├── vercel.json
├── tsconfig*.json                    # split app/node configs
├── public/
│   ├── favicon.svg
│   └── icons.svg                     # SVG sprite sheet
├── index.html
└── src/
    ├── App.tsx                       # Routes wrapped with ThemeProvider
    ├── main.tsx
    ├── index.css                     # Tailwind + tokens
    ├── theme.tsx                     # ThemeProvider (dark/light)
    ├── assets/                       # Logo variants
    ├── components/
    │   ├── Layout.tsx                # Top bar + side nav shell
    │   ├── ProtectedRoute.tsx
    │   ├── Settings.tsx              # In-app settings panel
    │   ├── CreateTicketModal.tsx     # ~16KB
    │   ├── EditTicketModal.tsx       # ~16KB
    │   ├── TicketDetailModal.tsx
    │   ├── ApprovalModal.tsx
    │   ├── CreateUserModal.tsx
    │   └── EditUserModal.tsx
    ├── pages/
    │   ├── Login.tsx
    │   ├── Dashboard.tsx             # Big page, ~25KB — lists + filters + actions
    │   ├── UserManagement.tsx
    │   ├── NotificationsPage.tsx
    │   └── ProfilePage.tsx
    ├── services/api.ts               # axios instance + interceptors
    ├── types/index.ts
    └── utils/
        ├── auth.ts
        └── labelStyles.tsx           # Status / priority pill styling
```

---

## API Reference

| Prefix | Auth | Surface |
|---|---|---|
| `GET /health` | none | `{ status: "UP", service, timestamp }` |
| `/auth` | none for `/login` | `POST /login` → JWT |
| `/users` | JWT | CRUD users, fetch role list, manage **own** notification-settings |
| `/tickets` | JWT | Create / list / get / update tickets, **approval** sub-routes (`/tickets/:id/approve`, `/reject`), status fetching |
| `/notifications` | JWT | List own notifications, mark read |

The frontend's `src/services/api.ts` is a thin axios wrapper that injects the JWT and points at `VITE_API_URL`.

### Ticket lifecycle (state machine)

```
[ OPEN ] ──(developer picks up)──► [ IN_PROGRESS ]
                                         │
                                         ▼
                                  [ READY_FOR_QA ]
                                         │
                ┌────────(approve)───────┴────────(reject)─────┐
                ▼                                              ▼
          [ RESOLVED ]                                [ ERROR_PERSISTS ]
                │                                              │
                ▼                                              ▼
            [ CLOSED ]                            ──(developer iterates)──┐
                                                                          │
                                                                          ▼
                                                                  [ IN_PROGRESS ]
```

`Approval` rows are created on `READY_FOR_QA → RESOLVED` and `READY_FOR_QA → ERROR_PERSISTS` transitions. The `comment` field becomes part of the ticket's audit trail.

---

## Authentication & Credentials

### Seeded super-admin

`npm run seed:users` (or `npm run db:reset` which runs all seeders) creates the super-admin:

| Email | Role | Password |
|---|---|---|
| `superadmin@test.com` | SuperAdmin | `password123` |

> The seeder uses `User.upsert`, so re-running it resets the password to `password123` — useful when you forget your local credentials.

### Adding more users

Sign in as the super-admin and use the **User Management** page to create users with any role. New users get default `notification_settings` (all `true`) auto-created on first request.

### Self-registration

This system has **no public signup** — accounts are created by admins/super-admins via the dashboard. To onboard yourself:

1. Run `npm run seed:users` locally.
2. Sign in as `superadmin@test.com` / `password123`.
3. Create your real user via **User Management → New User**.

---

## Deployment

### Backend → host-agnostic Node service

The backend is a stock Express + MySQL + Sequelize service. Recommended free-tier hosts:

- **Render Web Service** (Node) — connect the repo, set environment variables, point at MySQL.
- **Railway** — straightforward Node + MySQL combo.
- **Fly.io** — also fine.

The `postinstall` script runs `npm run build` so production deploys compile TypeScript automatically. Bootstrap the database once with `npm run db:reset` (sync schema + seed roles/statuses/users), then `npm start` serves the compiled app from `dist/server.js`.

### Frontend → Vercel

```bash
cd service-ticket-system-frontend
npm install
npm run build      # → dist/
```

Vercel auto-detects Vite. SPA fallback routing is configured in `vercel.json`. Set `VITE_API_URL` in Vercel's project settings.

Live build: **[service-ticket-system-frontend.vercel.app](https://service-ticket-system-frontend.vercel.app)**.

---

## Cost Breakdown

> **Designed for $0/month forever** on free tiers across the entire stack.

| Service | Free tier | We use | Headroom |
|---------|-----------|--------|----------|
| **Render Web Service** (or Railway / Fly) | 750 hours/mo, sleeps after 15 min | always-on under monitoring | within limits |
| **MySQL** (Aiven / FreeSQLDatabase / Filess.io) | 5 GB / 1 GB depending on provider | <50 MB | **95%+** |
| **Vercel Hobby** (frontend) | 100 GB bandwidth, unlimited deploys | <500 MB/mo | **99.5%** |
| **GitHub Actions** (public repo) | unlimited minutes | n/a (Vercel auto-deploys) | unlimited |
| **GitHub Releases** | unlimited public assets | n/a | unlimited |

**Total: $0/month.**

**Why each free tier was chosen:**

- **MySQL over PostgreSQL** — broader free-tier availability (Aiven, FreeSQLDatabase, Filess.io, etc.).
- **bcryptjs over bcrypt** — pure JS, no native build step, deploys cleanly to Render free tier and serverless platforms.
- **Vercel for the SPA** — global CDN + free SSL + automatic deploys + zero-config Vite detection.
- **node-cron in-process** — saves an entire worker service; trade-off is that scaling horizontally requires leader election, but at portfolio scale a single Node process is plenty.

---

## Local Development

### Backend

```bash
git clone https://github.com/Asciente-rks/service-ticket-system.git
cd service-ticket-system
npm install                # postinstall runs npm run build

# Start MySQL locally and create the database
# Then bootstrap the schema + seed reference data
npm run db:sync            # CREATE TABLEs via sequelize.sync()
npm run seed:roles         # 4 role rows with the hardcoded UUIDs
npm run seed:status        # 6 ticket-status rows with the hardcoded UUIDs
npm run seed:users         # SuperAdmin account
# Or do all four at once:
npm run db:reset

npm run dev                # nodemon → ts-node src/server.ts (port 3000)
```

### Frontend

```bash
git clone https://github.com/Asciente-rks/service-ticket-system-frontend.git
cd service-ticket-system-frontend
npm install
npm run dev                # Vite on :5173 with HMR
npm run lint
npm run build && npm run preview
```

Set `VITE_API_URL=http://localhost:3000` in `.env.local` while pointing at the local backend.

### Environment Variables

**Backend** (`.env`):

```env
NODE_ENV=development
PORT=3000
SERVICE_NAME=service-ticket-system

# MySQL (Sequelize)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=service_tickets
DB_USER=root
DB_PASSWORD=...

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=7d
```

**Frontend** (`.env.local`):

```env
VITE_API_URL=http://localhost:3000   # or your deployed backend URL
```

---

## Author

Built by **Ralph Kenneth F. Sonio** ([@Asciente-rks](https://github.com/Asciente-rks)). Live at **[service-ticket-system-frontend.vercel.app](https://service-ticket-system-frontend.vercel.app)**.
