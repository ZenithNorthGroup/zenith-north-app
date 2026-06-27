# Zenith North — Setup Guide

## Prerequisites

- Node.js 20+
- A Neon or Supabase PostgreSQL database
- A Clerk account (clerk.com)
- An Anthropic API key (console.anthropic.com)

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Environment setup

```bash
cp .env.local.example .env.local
```

Fill in your `.env.local`:

```env
# Clerk — get from dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Database — Neon recommended (neon.tech)
DATABASE_URL=postgresql://user:password@host/zenith_north?sslmode=require

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Optional for Phase 2
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx
```

---

## 3. Database setup

Push schema to your database:

```bash
npm run db:push
```

Then run the initial migration SQL (RLS policies + default data):

```bash
# Connect to your DB and run:
psql $DATABASE_URL -f src/lib/db/migrations/0001_initial.sql
```

---

## 4. Run development server

```bash
npm run dev
```

Open http://localhost:3000

---

## 5. Create your first tenant

After signing in through Clerk, the app will redirect you to `/dashboard`.
You'll need to run the tenant setup script to create your firm:

```typescript
// Run this once in a script or admin route:
import { setupTenant } from '@/lib/auth/tenantSetup'

await setupTenant({
  firmName:    'Wright Advisory LLC',
  firmSlug:    'wright-advisory',
  plan:        'professional',
  ownerEmail:  'james@wrightadvisory.com',
  ownerName:   'James Wright',
  clerkUserId: 'user_xxxxx', // from Clerk dashboard
})
```

---

## File structure

```
src/
  app/
    (auth)/          # Sign in / sign up pages
    (dashboard)/     # All protected dashboard routes
      dashboard/     # Home dashboard
      clients/       # Client list + Client 360
      workflows/     # Workflow runs + approval
      compliance/    # Compliance dashboard
      messages/      # Compliant messaging
      audit/         # Audit center + exam packages
      builder/       # Workflow builder
      import/        # Redtail importer
      ai/            # AI assistant
      calendar/      # Calendar
      tasks/         # Tasks
      documents/     # Document storage
      reports/       # Reports (Phase 3)
    api/trpc/        # tRPC API handler

  server/
    root.ts          # Root tRPC router
    routers/
      clients.ts     # Client CRUD + Client 360
      compliance.ts  # Compliance dashboard + policy engine
      workflows.ts   # Workflow runs + step gating + approvals
      messages.ts    # Compliant messaging + AI monitoring
      import.ts      # Redtail + CSV importer

  lib/
    db/
      schema.ts      # Complete Drizzle schema (all 10 domains)
      index.ts       # DB connection + withTenant()
      migrations/    # SQL migrations with RLS policies
    auth/
      tenantSetup.ts # New firm bootstrap
    audit/
      index.ts       # Audit log writer + exam package generator
    trpc/
      context.ts     # Request context (auth + tenant resolution)
      index.ts       # tRPC setup + middleware
      provider.tsx   # React Query provider

  components/
    layout/
      Sidebar.tsx    # Nav + compliance pulse indicator
      Topbar.tsx     # Breadcrumbs + search

  middleware.ts      # Clerk auth protection
```

---

## What's built (Phase 1 complete)

### Backend
- [x] Complete database schema (10 domains, RLS, append-only audit log)
- [x] Clerk auth + multi-tenancy
- [x] tRPC API layer
- [x] Clients router (full CRUD + versioning + Client 360)
- [x] Compliance router (dashboard + policy engine + resolve/snooze)
- [x] Workflows router (runs + step gating + approvals + policy gate)
- [x] Messages router (send + AI scan + flag review)
- [x] Import router (Redtail CSV + generic CSV)
- [x] Audit log writer (automatic on every write)
- [x] Tenant setup utility

### Frontend
- [x] App shell (sidebar + topbar + nav)
- [x] Dashboard home (live compliance data)
- [x] Clients list (search + filter)
- [x] Client 360 (timeline + compliance items)
- [x] Compliance dashboard (action queue + SEC filings)
- [x] Workflows page (run tracker + expandable steps)
- [x] Approval page (full checklist + three outcomes)
- [x] Messages page (thread list + AI flag display)
- [x] Audit center (log viewer + exam package generator)
- [x] Workflow builder (visual step editor)
- [x] Redtail import (drag-drop + preview + confirm)
- [x] AI assistant (natural language interface)
- [x] Calendar (compliance deadlines + events)
- [x] Tasks (workflow-aware task management)
- [x] Documents (versioned storage)
- [x] Reports (Phase 3 placeholder)

---

## Next to build (Phase 2)

- [ ] Audit tRPC router (real log query + exam package API)
- [ ] Calendar tRPC router (real event management)
- [ ] Tasks tRPC router (real task CRUD)
- [ ] Documents tRPC router (real upload + storage via R2)
- [ ] Client portal (separate Next.js app on portal.subdomain.com)
- [ ] E-signature flow (internal + DocuSign integration)
- [ ] Compliance engine job (hourly scan — Inngest)
- [ ] Annual review engine job (nightly scan)
- [ ] AI API route (/api/ai/ask — routes to Anthropic with firm context)
- [ ] Portal magic link auth
- [ ] Webhook handler (Clerk org created → setupTenant)

---

## Pricing (locked)

| Tier         | Subscription  | Setup fee          |
|--------------|---------------|--------------------|
| Starter      | $2,700/mo     | $8,500             |
| Professional | $5,500/mo     | $15,000–$20,000    |
| Enterprise   | $10,000/mo    | $30,000–$50,000    |

Annual: 2 months free. Founding firms (first 10): setup fee waived, rate locked forever.
