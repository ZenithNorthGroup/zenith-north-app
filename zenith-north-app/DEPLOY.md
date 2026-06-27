# Zenith North — Deploy to Production

## Overview

Three apps, one database, 45 minutes start to finish.

```
zenith-north-app/     → app.zenith-north.com     (firm dashboard)
zenith-north-portal/  → portal.zenith-north.com  (client onboarding)
zenith-north-admin/   → admin.zenith-north.com   (your internal panel)
```

---

## Prerequisites

Install these if you don't have them:
```bash
npm install -g vercel
```

---

## Step 1 — Database (Neon)

1. Go to **neon.tech** → Create project → Name it `zenith-north`
2. Select region: `US East (N. Virginia)` — closest to Vercel's iad1
3. Copy the connection string from the dashboard
4. It looks like: `postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`

**Push the schema:**
```bash
cd zenith-north-app
cp .env.local.example .env.local
# Fill in DATABASE_URL with your Neon connection string
npm install
npm run db:push
```

**Run the initial migration (RLS policies):**
```bash
# Connect to your Neon DB and run the migration file
psql $DATABASE_URL -f src/lib/db/migrations/0001_initial.sql
```

---

## Step 2 — Clerk Auth

1. Go to **clerk.com** → Create application
2. Name: `Zenith North`
3. Sign-in options: Email + Google
4. Copy **Publishable Key** and **Secret Key** from API Keys page
5. **Set up webhook** (critical — users won't be able to sign in without this):
   - Webhooks → Add Endpoint
   - URL: `https://app.zenith-north.com/api/webhooks/clerk`
   - Events: check `user.created` and `session.created`
   - Copy **Signing Secret** → `CLERK_WEBHOOK_SECRET` env var

---

## Step 3 — Anthropic API

1. Go to **console.anthropic.com** → API Keys → Create Key
2. Name: `zenith-north-production`
3. Copy the key (starts with `sk-ant-`)

---

## Step 4 — Twilio (SMS)

1. Go to **console.twilio.com** → Create account
2. Buy a phone number: Numbers → Buy a Number → filter by SMS capability
3. Copy Account SID and Auth Token from the dashboard
4. **Register for 10DLC** (required for business SMS):
   - Go to Messaging → Regulatory Compliance → Trust Hub
   - Register your business (takes 2-5 business days)
5. Set the inbound webhook URL (after Step 6):
   - Phone Numbers → Manage → your number → Messaging
   - Webhook URL: `https://app.zenith-north.com/api/sms/inbound`

---

## Step 5 — Sendgrid (Email ingest)

1. Go to **sendgrid.com** → Create account
2. Settings → Inbound Parse → Add Host & URL:
   - Hostname: `mail.zenith-north.com`
   - URL: `https://app.zenith-north.com/api/email/ingest`
   - Check: "POST the raw, full MIME message"
3. Add MX record to your DNS:
   ```
   mail.zenith-north.com  MX  10  mx.sendgrid.net
   ```

---

## Step 6 — Deploy main app

```bash
cd zenith-north-app
vercel
```

When prompted:
- Project name: `zenith-north-app`
- Framework: Next.js (auto-detected)

**Add environment variables in Vercel dashboard:**

Go to your project → Settings → Environment Variables and add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk |
| `CLERK_SECRET_KEY` | From Clerk |
| `DATABASE_URL` | From Neon |
| `ANTHROPIC_API_KEY` | From Anthropic |
| `TWILIO_ACCOUNT_SID` | From Twilio |
| `TWILIO_AUTH_TOKEN` | From Twilio |
| `TWILIO_PHONE_NUMBER` | Your Twilio number e.g. +14155550100 |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` |
| `PORTAL_SECRET` | Generate: `openssl rand -hex 32` |
| `SERVICE_SECRET` | Generate: `openssl rand -hex 32` |
| `ADMIN_SECRET` | Generate: `openssl rand -hex 32` |
| `PORTAL_URL` | `https://portal.zenith-north.com` |
| `MAIN_API_URL` | `https://app.zenith-north.com` |

**Redeploy after adding variables:**
```bash
vercel --prod
```

**Set custom domain:**
Go to project → Settings → Domains → Add `app.zenith-north.com`

---

## Step 7 — Deploy client portal

```bash
cd zenith-north-portal
vercel
```

Add environment variables:
| Variable | Value |
|---|---|
| `PORTAL_SECRET` | Same value as main app |
| `MAIN_API_URL` | `https://app.zenith-north.com` |
| `SERVICE_SECRET` | Same value as main app |

Set domain: `portal.zenith-north.com`

---

## Step 8 — Deploy admin panel

```bash
cd zenith-north-admin
vercel
```

Add environment variables:
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://app.zenith-north.com` |
| `ADMIN_SECRET` | Same value as main app |

Set domain: `admin.zenith-north.com`

> ⚠️  Keep this URL private — this is your internal tool only.

---

## Step 9 — Seed demo data

Get your Clerk User ID from dashboard.clerk.com → Users → your account → User ID

```bash
cd zenith-north-app
DEMO_USER_CLERK_ID=user_xxxxx npx tsx scripts/seed-demo.ts
```

This creates:
- Wright Advisory LLC firm
- 12 demo clients
- 3 workflow runs (approval pending, stalled, complete)
- 5 compliance items (2 critical)
- Sample communications with 1 AI flag
- Audit log entries

---

## Step 10 — Zoom (optional for demo)

1. Go to **marketplace.zoom.us** → Build App → Webhook Only App
2. App name: `Zenith North`
3. Event Subscriptions → Add: `recording.completed`
4. Endpoint URL: `https://app.zenith-north.com/api/zoom/recording`
5. Copy the Webhook Secret Token
6. Add to Vercel: `ZOOM_WEBHOOK_SECRET`

---

## Step 11 — Schedule compliance engine

The compliance engine needs to run nightly. Use Vercel Cron:

Add to `vercel.json` in the main app:
```json
{
  "crons": [{
    "path": "/api/compliance/engine",
    "schedule": "0 2 * * *"
  }]
}
```

But the endpoint needs the cron secret. Vercel sends `Authorization: Bearer $CRON_SECRET` — update the engine route to check that header too.

Or use **Upstash QStash** (simpler):
1. upstash.com → QStash → Schedule
2. URL: `https://app.zenith-north.com/api/compliance/engine`
3. Header: `X-Cron-Secret: your-secret`
4. Schedule: `0 2 * * *`

---

## DNS records needed

```
app.zenith-north.com    → Vercel (main app)
portal.zenith-north.com → Vercel (client portal)
admin.zenith-north.com  → Vercel (admin panel)
mail.zenith-north.com   → MX: mx.sendgrid.net (email ingest)
```

---

## Demo walkthrough script

Once deployed and seeded:

**1. Dashboard** (30 seconds)
> "The first thing you see is your compliance pulse. Two critical items need attention today."

**2. Clients** (60 seconds)
> "147 clients. Here's your active book. Filter by KYC status — these three need verification."
> Click Margaret Chen → Client 360 → show timeline, compliance items, communications

**3. Workflows** (90 seconds)
> "Sandra Chukwu's onboarding needs your approval."
> Click into Sandra's workflow → show step checklist → click Approve → "That's now in the audit log forever."

**4. Messages** (60 seconds)
> "Every message — platform, email, SMS — runs through AI compliance scanning."
> Show David Kim thread → click the flag → "This is the kind of thing that causes $15 million fines. We caught it automatically."

**5. Audit center** (30 seconds)
> "One click — everything an SEC examiner would ever ask for."
> Click Generate exam package → download → "This is what Smarsh charges $86,000 a year to produce."

**6. Integrations** (30 seconds)
> "Email journaling with Microsoft 365 or Google Workspace. Copy this address, paste it into Purview. You're done."

**Total demo: 5 minutes.**

---

## Troubleshooting

**DB connection fails:** Check that your Neon DB is not paused (free tier pauses after inactivity). Go to neon.tech and wake it.

**Clerk auth redirect loop:** Make sure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_live_` for production, not `pk_test_`.

**Email not arriving:** Check Sendgrid Inbound Parse settings and verify the MX record has propagated (use `dig MX mail.zenith-north.com`).

**AI not responding:** Check Anthropic API key and that you have credits. The AI assistant and compliance scan both use `claude-sonnet-4-6`.

**Seed script fails:** Make sure you've run `npm run db:push` first and that the initial migration SQL has been applied.
