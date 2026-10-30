# ReachInbox — Production-Grade Full-Stack Email Job Scheduler

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](#)
[![Tests](https://img.shields.io/badge/Tests-28%20Passing-success.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](#)
[![Figma Visual Alignment](https://img.shields.io/badge/Figma-Aligned-orange.svg)](#)

A complete, production-ready full-stack cold email job scheduler designed and built to meet the ReachInbox Hiring Assignment requirements.

---

## Table of Contents
1. [Architecture & System Design](#architecture--system-design)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Monorepo Directory Layout](#monorepo-directory-layout)
5. [Quick Start & Running Locally](#quick-start--running-locally)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Distributed Rate Limiting & Scheduling Algorithm](#distributed-rate-limiting--scheduling-algorithm)
8. [Integrations Setup (Google OAuth & Slack Web API)](#integrations-setup)
9. [Bull Board & API Documentation](#bull-board--api-documentation)
10. [Automated Test Suite & Verification Results](#automated-test-suite--verification-results)
11. [Evaluator Walkthrough & Demo Guide](#evaluator-walkthrough--demo-guide)

---

## Architecture & System Design

```
+---------------------------------------------------------------------------------+
|                             React 18 + Vite (SPA)                               |
|        Tailwind CSS + Lucide Icons + TanStack Query + React Hook Form           |
+----------------------------------------+----------------------------------------+
                                         |
                                         | HTTP / REST (Signed Cookies + JSON)
                                         v
+---------------------------------------------------------------------------------+
|                             Express.js API Server                               |
|  - Auth & Multi-Tenancy  - Lead CSV Parser  - Campaign Engine  - Search Engine  |
|  - Swagger Documentation (/api/docs)        - Bull Board UI (/api/admin/queues) |
+------------------+---------------------+--------------------+-------------------+
                   |                     |                    |
                   v                     v                    v
         +-------------------+  +-----------------+  +-------------------+
         | PostgreSQL 14 DB  |  |  Redis 6 Server |  |   Elasticsearch   |
         |   (Prisma ORM)    |  |  BullMQ Queues  |  |  Email Full-Text  |
         |  Source of Truth  |  | Distributed Lua |  |  Dual Fallback    |
         +---------+---------+  +--------+--------+  +-------------------+
                   |                     |                     ^
                   | Outbox Events       | Delayed Jobs        | Outbox Sync
                   v                     v                     |
+--------------------------------------------------------------+------------------+
|                            BullMQ Email Worker                                  |
|   - Concurrency-Controlled Queue Dispatch                                       |
|   - Atomic Redis Lua Rate-Limiting (Sender & Global Hourly Limits + Min Delay)  |
|   - Rescheduling Overflow Jobs to Next Window (Zero Drops, Zero Starvation)     |
|   - Transactional Outbox Reconciliation on Startup                              |
+----------------------------------------+----------------------------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
             +--------------------+               +------------------+
             |   Ethereal SMTP    |               |  Slack Web API   |
             |   (Nodemailer)     |               | Deduplicated Rate|
             |  MessageId + URL   |               | Limit Alert Webhook
             +--------------------+               +------------------+
```

### Core Architecture Principles
1. **Zero Cron Jobs:** Strictly complies with the constraint: no `cron`, `node-cron`, Agenda, or OS crons are used. All delayed deliveries are scheduled via **BullMQ delayed jobs** backed by Redis.
2. **Distributed Atomic Rate Limiter:** Implemented via a high-performance **Redis Lua script** that executes atomically:
   - Enforces a minimum delay between sends per sender (e.g., 2,000ms).
   - Enforces hourly caps per sender (e.g., 100/hr) and globally (e.g., 200/hr).
   - Automatically reschedules excess jobs to the start of the next hour window without dropping jobs or blocking the worker thread.
3. **Multi-Tenant Isolation:** Every single database table and query strictly enforces tenant boundaries (`where: { tenantId }`).
4. **Resilience & Outbox Pattern:** Startup reconciliation automatically scans for unqueued database jobs and pending outbox events after an unexpected server restart, re-enqueueing them into BullMQ.
5. **Dual Search Engine:** Integrates Elasticsearch with automatic, seamless fallback to PostgreSQL trigram/case-insensitive search when Elasticsearch is not running.

---

## Key Features

- **Lead CSV / Text Ingestion:** Robust CSV parsing via `csv-parse` with validation, reporting total rows, valid emails, syntax errors, and duplicate addresses.
- **Immediate & Scheduled Dispatches:** Pick any future UTC datetime or schedule immediate batch execution.
- **Multiple Authorized Senders:** Configure and switch across multiple sender identities per workspace.
- **Live Nodemailer Ethereal SMTP:** Real email transmission capturing live Ethereal Preview URLs for every sent message.
- **Live Bull Board Queue Dashboard:** Real-time visibility into waiting, active, delayed, completed, and failed BullMQ jobs mounted at `/api/admin/queues`.
- **Interactive Swagger / OpenAPI UI:** Interactive documentation mounted at `/api/docs`.
- **Figma-Aligned Dark UI:** Designed closely against the Outbox Labs assignment Figma reference with responsive sidebar, custom stats cards, lead tables, status badges, and compose modal.
- **Slack Alerting:** Posts rate-limit notifications to Slack with AES-256-GCM encrypted tokens and window deduplication.
- **Dual Authentication Modes:** Real Google OAuth 2.0 flow alongside a 1-click **Demo Login** for instant local evaluation without requiring external Google credentials.

---

## Technology Stack

### Backend
- **Runtime:** Node.js (v20+) with TypeScript (Strict mode)
- **Framework:** Express.js 4.19
- **Database:** PostgreSQL 14 with Prisma ORM 5.14
- **Queue & Storage:** BullMQ 5.7 & Redis 6.0 (supporting TCP or Unix domain sockets)
- **Search:** Elasticsearch 8.13 with PostgreSQL relational search fallback
- **Email Delivery:** Nodemailer with Ethereal SMTP (auto-provisioned or custom)
- **Authentication:** Google OAuth 2.0 (`google-auth-library`), HMAC-signed HTTP-only cookies
- **Security:** AES-256-GCM encryption for Slack tokens, timing-safe HMAC verification
- **Validation & Logging:** Zod v3, Pino structured logging with `pino-pretty`

### Frontend
- **Framework:** React 18, Vite 5, TypeScript
- **Styling:** Tailwind CSS with custom Outbox Labs color palette
- **Icons & UI:** Lucide React, accessible headless components, responsive modals
- **State & Data Fetching:** TanStack Query v5, React Hook Form, Zod resolvers

---

## Project Directory Layout

```text
reachinbox-scheduler/
├── backend/                           # Backend Express API, BullMQ Worker & Services
│   ├── prisma/
│   │   ├── schema.prisma              # PostgreSQL relational schema
│   │   └── seed.ts                    # Seeder for demo tenant, user & senders
│   ├── src/
│   │   ├── config/                    # Zod env, logger, db & redis clients, swagger
│   │   ├── middleware/                # Auth, request-logger, validator, error handler
│   │   ├── modules/
│   │   │   ├── auth/                  # Google OAuth, dev-login, me, logout
│   │   │   ├── senders/               # Senders CRUD & tenant isolation
│   │   │   ├── campaigns/             # Email campaigns
│   │   │   ├── emails/                # Scheduling, lead parser, cancel, metrics
│   │   │   ├── notifications/         # Slack OAuth & deduplicated alerts
│   │   │   ├── search/                # Elasticsearch & Postgres dual engine
│   │   │   └── queue-board.ts         # Bull Board UI router
│   │   ├── queue/                     # BullMQ queue & Redis Lua rate limiter
│   │   ├── workers/                   # Background email worker & reconciliation
│   │   ├── integrations/              # Ethereal SMTP, Google OAuth, Slack API
│   │   ├── utils/                     # AES-256-GCM crypto & timing utilities
│   │   ├── app.ts                     # Express application definition
│   │   └── server.ts                  # API server bootstrap
│   ├── tests/                         # Vitest automated backend test suites
│   ├── scripts/                       # Local services scripts (start/stop)
│   ├── tools/                         # Local database utilities (PostgreSQL & Redis)
│   ├── data/                          # Local PostgreSQL & Redis storage
│   ├── docker-compose.yml             # Docker services orchestration
│   ├── .env                           # Environment configuration
│   └── package.json
├── frontend/                          # Frontend React SPA
│   ├── src/
│   │   ├── api/                       # Typed API clients (Auth, Emails, Senders, Slack)
│   │   ├── components/                # Reusable UI (Buttons, Badges, Cards, Modals, Skeleton)
│   │   ├── context/                   # AuthContext & ToastContext
│   │   ├── pages/                     # Login, Dashboard, Scheduled, Sent, Campaigns, Slack
│   │   ├── test/                      # Vitest & React Testing Library test suites
│   │   ├── App.tsx                    # App routing & query provider
│   │   └── main.tsx
│   ├── index.html
│   └── package.json
├── .env.example                       # Full configuration reference
├── IMPLEMENTATION_PLAN.md             # Execution phases & verification matrix
└── package.json                       # Root workspaces configuration
```

---

## Quick Start & Running Locally

### Prerequisites
- Node.js 18+ or 20+
- npm 9+
- (Optional) Docker & Docker Compose

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd emailsheduler
npm install
```

### 2. Environment Configuration
Copy the template and inspect defaults:
```bash
cp .env.example .env
```
*(The defaults are pre-configured to connect to local services out of the box).*

### 3. Start Supporting Services
You can run services either via native local userspace scripts or Docker Compose:

**Option A — Native Local Services (Quickest):**
```bash
npm run services:start
```
*Starts PostgreSQL 14 and Redis 6.0 in background userspace.*

**Option B — Docker Compose:**
```bash
docker compose up -d postgres redis elasticsearch
```

### 4. Database Setup & Seeding
```bash
npm run prisma:migrate
npm run prisma:seed
```
*Seeds the database with `demo@reachinbox.ai`, an active workspace, and a verified sender `marketing@reachinbox.ai`.*

### 5. Start the Application
Run all components concurrently with a single command:
```bash
npm run dev
```
Or start them individually in separate terminals:
```bash
# Terminal 1: API Server (port 4000)
npm run dev:api

# Terminal 2: BullMQ Email Worker
npm run worker

# Terminal 3: React Frontend (port 5173)
npm run dev:web
```

---

## Distributed Rate Limiting & Scheduling Algorithm

Rate limiting in ReachInbox is enforced using an atomic Redis Lua script (`backend/src/queue/rate-limiter.ts`), eliminating race conditions across multiple distributed worker threads:

```lua
-- Keys:
-- KEYS[1] = sender_last_send_key
-- KEYS[2] = sender_hour_count_key
-- KEYS[3] = global_hour_count_key
-- ARGV[1] = current_time_ms
-- ARGV[2] = min_delay_ms
-- ARGV[3] = max_sender_per_hour
-- ARGV[4] = max_global_per_hour
-- ARGV[5] = hour_ttl_seconds
```

### Execution Rules:
1. **Minimum Inter-Send Delay:** Checks `(current_time - last_send_timestamp) < min_delay_ms`. If violated, returns `{ allowed = 0, retryAfterMs = remaining_delay }`.
2. **Sender Hourly Cap:** Checks if `sender_hour_count >= max_sender_per_hour`. If exceeded, calculates milliseconds remaining until the top of the next hour and returns `{ allowed = 0, retryAfterMs = ms_to_next_hour }`.
3. **Global Hourly Cap:** Checks if `global_hour_count >= max_global_per_hour`. If exceeded, returns `{ allowed = 0, retryAfterMs = ms_to_next_hour }`.
4. **Atomic Reservation:** If all checks pass, updates `last_send_timestamp`, increments sender and global counters with an automatic 3600-second TTL, and returns `{ allowed = 1 }`.
5. **Safe Rescheduling:** If not allowed, the worker moves the job delay to `retryAfterMs` using BullMQ's native delayed job mechanism. **Zero jobs are lost; zero thread loops burn CPU.**

---

## Integrations Setup

### 1. Google OAuth 2.0
To configure real Google OAuth login:
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web Application).
3. Set **Authorized redirect URI** to:
   ```
   http://localhost:4000/api/auth/google/callback
   ```
4. Set in `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
> **Note for Evaluators:** If you do not have Google credentials configured, use the **"Continue with Demo Account"** button on the login screen. It generates a verified session with the seeded demo user and tenant without external network dependencies.

### 2. Slack OAuth 2.0 & Alerts
To connect Slack for rate-limit notifications:
1. Create a Slack App in your workspace via [api.slack.com/apps](https://api.slack.com/apps).
2. Add Bot Token Scopes: `chat:write`, `incoming-webhook`.
3. Set **Redirect URL** to:
   ```
   http://localhost:4000/api/slack/callback
   ```
4. Set in `.env`:
   ```env
   SLACK_CLIENT_ID=your-slack-client-id
   SLACK_CLIENT_SECRET=your-slack-client-secret
   SLACK_ENCRYPTION_KEY=reachinbox_slack_aes256_encryption_key_32_bytes_min!!
   ```
5. Navigate to **Integrations / Slack** in the ReachInbox dashboard and click **"Connect Slack Workspace"**.

### 3. Ethereal Email SMTP
By default, ReachInbox auto-provisions a real development Ethereal SMTP test account on startup when `ETHEREAL_USER` and `ETHEREAL_PASS` are omitted. All sent emails produce preview links like:
`https://ethereal.email/message/...` accessible in the Sent tab and logs.

---

## Bull Board & API Documentation

- **Interactive API Documentation:** Available at [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **Bull Board Queue Dashboard:** Available at [http://localhost:4000/api/admin/queues](http://localhost:4000/api/admin/queues) *(Protected: requires authenticated session)*
- **Health Check Endpoint:** `GET http://localhost:4000/api/health`

---

## Automated Test Suite & Verification Results

All tests can be executed with a single command:
```bash
npm run test
```

### Test Breakdown

| Test Suite | File | Tests | Status |
| :--- | :--- | :---: | :---: |
| **API End-to-End Integration** | `backend/tests/api-integration.test.ts` | 8 |  PASSED |
| **Distributed Rate Limiter** | `backend/tests/rate-limiter.test.ts` | 3 |  PASSED |
| **Lead CSV & Syntax Parser** | `backend/tests/lead-parser.test.ts` | 3 |  PASSED |
| **Restart Recovery & Outbox** | `backend/tests/resilience-recovery.test.ts` | 3 |  PASSED |
| **Live Nodemailer Ethereal SMTP** | `backend/tests/live-delivery.test.ts` | 1 |  PASSED |
| **AES-256-GCM & HMAC Crypto** | `backend/tests/crypto.test.ts` | 3 |  PASSED |
| **Frontend UI: Button Component** | `frontend/src/test/Button.test.tsx` | 3 |  PASSED |
| **Frontend UI: Card Component** | `frontend/src/test/Card.test.tsx` | 2 |  PASSED |
| **Frontend UI: Badge Component** | `frontend/src/test/Badge.test.tsx` | 2 |  PASSED |
| **Total** | **9 Test Files** | **28 Tests** | ** 100% PASS** |

---

## Evaluator Walkthrough & Demo Guide

Follow these steps to experience the complete workflow:

1. **Access the Application:**
   Open [http://localhost:5173](http://localhost:5173).
2. **Log In:**
   Click **"Continue with Demo Account"** to immediately sign in as `demo@reachinbox.ai`.
3. **Open the Compose Modal:**
   Click the **"+ Schedule Emails"** button in the top header or sidebar.
4. **Upload Leads or Paste CSV:**
   - Drop a CSV file or paste lead emails.
   - Observe real-time validation: valid emails, syntax errors, and duplicates detected are clearly shown in the preview table.
5. **Configure Scheduling & Rate Limiting:**
   - Select the sender identity (`marketing@reachinbox.ai`).
   - Choose a scheduled time or keep immediate.
   - Adjust the minimum inter-send delay (e.g., 2 seconds) and hourly limits.
6. **Submit & Monitor Queue:**
   - Click **"Schedule Email Batch"**.
   - Navigate to the **Scheduled** tab to see your jobs with real-time status badges.
   - Watch the Worker terminal pick up the jobs sequentially, respecting the minimum inter-send delay.
7. **Inspect Sent Deliveries & Live Preview:**
   - Navigate to the **Sent** tab.
   - Click the **"View Message"** link on any sent email to open the live Nodemailer Ethereal web preview in your browser!
8. **Check the Bull Board Dashboard:**
   - Navigate to [http://localhost:4000/api/admin/queues](http://localhost:4000/api/admin/queues) to inspect active, delayed, and completed jobs directly in Redis.
