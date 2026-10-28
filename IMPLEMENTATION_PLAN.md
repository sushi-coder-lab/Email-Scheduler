# ReachInbox — Implementation Plan & Verification Checklist

## Executive Summary
This document tracks the end-to-end architecture, implementation phases, and automated verification checklist for ReachInbox — Production-Grade Full-Stack Email Job Scheduler.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       React + Vite Frontend (SPA)     |
                      |   Tailwind CSS + Lucide + Query Client|
                      +-------------------+-------------------+
                                          |
                                          | HTTP / REST (Cookies + JSON)
                                          v
                      +---------------------------------------+
                      |           Express.js API              |
                      | Auth, Senders, Campaigns, Emails, etc.|
                      +---------+---------+---------+---------+
                                |         |         |
           +--------------------+         |         +-------------------+
           |                              |                             |
           v                              v                             v
  +------------------+          +------------------+          +-------------------+
  | PostgreSQL 14 DB |          |  Redis 6 Server  |          |   Elasticsearch   |
  |  Prisma Client   |          |  Atomic Counters |          |  Search & Indices |
  | (Source of Truth)|          |  Sliding Windows |          +-------------------+
  +--------+---------+          +---------+--------+                    ^
           |                              |                             |
           | Transactional Outbox         | BullMQ Delayed Jobs         | Outbox Indexer
           v                              v                             |
  +------------------------------------------------+                    |
  |             BullMQ Email Worker                +--------------------+
  |  Concurrency Bounded, Min-Delay & Rate-Limiter |
  +-----------------------+------------------------+
                          |
             +------------+------------+
             |                         |
             v                         v
     +---------------+        +-----------------+
     | Ethereal SMTP |        |  Slack Web API  |
     | (Nodemailer)  |        | Rate Limit Alert|
     +---------------+        +-----------------+
```

---

## Requirement Verification Checklist

Legend:
- `[ ]` PENDING — Not yet implemented
- `[x]` PASS — Implemented and verified via automated tests or running services
- `[-]` BLOCKED — Requires external credentials (e.g., live Slack bot token or live Google OAuth client secret from evaluator)

### 1. Authentication & Tenancy
- [x] Real Google OAuth 2.0 flow (`/api/auth/google`, `/api/auth/google/callback`)
- [x] Authenticated user endpoint (`/api/auth/me`)
- [x] Logout and session invalidation (`/api/auth/logout`)
- [x] Multi-tenant isolation (all database operations scoped to user's authorized tenant)
- [x] Secure HTTP-only cookies and CSRF protections

### 2. Database & Data Model (PostgreSQL + Prisma)
- [x] Relational schema with Users, Tenants, Memberships, Senders, Campaigns, EmailJobs, SlackConnections, OutboxEvents, NotificationDeduplications
- [x] Proper indexes, foreign keys, unique constraints, and status enums
- [x] Database migrations executed and verified

### 3. Email Scheduling API & Lead Ingestion
- [x] Endpoint `/api/campaigns` (Create & list campaigns)
- [x] Endpoint `/api/emails/schedule` (Bulk or single schedule with idempotency key)
- [x] CSV & plain-text lead upload parsing with validation
- [x] Exact counts: Total detected, Valid emails, Invalid syntax, Duplicates detected
- [x] Safe batch ingestion without memory blowup
- [x] Cancellation endpoint `/api/emails/:id/cancel` for eligible jobs

### 4. BullMQ & Persistent Background Processing
- [x] BullMQ queue and worker processes with deterministic job IDs (`email-job-${id}`)
- [x] Delayed job scheduling based on target timestamp
- [x] Configurable worker concurrency (`WORKER_CONCURRENCY`)
- [x] Bounded exponential backoff retries for transient failures
- [x] State management: `SCHEDULED`, `QUEUED`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`, `RETRYING`, `DELIVERY_UNKNOWN`
- [x] Startup reconciliation: Outbox recovery restoring pending DB jobs to BullMQ after restart

### 5. Throughput, Minimum Delay & Distributed Rate Limiting
- [x] Distributed minimum send delay between emails per sender (`MIN_DELAY_BETWEEN_EMAILS_MS`) enforced via atomic Redis reservation
- [x] Distributed hourly limits (`MAX_EMAILS_PER_HOUR_GLOBAL`, `MAX_EMAILS_PER_HOUR_PER_SENDER`) via atomic Redis script
- [x] Safe rate-limit rescheduling: jobs exceeding the limit are moved to the next eligible window rather than failed
- [x] Preserves queue order without busy-waiting or thread starvation

### 6. SMTP & Ethereal Email Integration
- [x] Nodemailer transport with Ethereal Email
- [x] Auto-provisioning of development Ethereal test account if credentials not supplied
- [x] Capture and persist SMTP message ID and preview URL
- [x] Transparent distinction between SMTP acceptance and mailbox delivery

### 7. Slack OAuth & Rate-Limit Alerts
- [x] Slack OAuth 2.0 flow (`/api/slack/connect`, `/api/slack/callback`, `/api/slack/connection`)
- [x] Secure token encryption at rest (AES-256-GCM)
- [x] Real Slack notifications sent via Web API when rate limit is hit
- [x] Notification deduplication per tenant/sender/window
- [x] Graceful degradation when Slack is not connected or API fails

### 8. Elasticsearch Indexing & Search
- [x] Document index mapping for email records
- [x] Full-text and keyword search (`/api/search/emails`)
- [x] Filtering by status, sender, campaign, recipient, date range
- [x] Tenant-scoped search queries
- [x] Resilient indexing outbox with rebuild capability (`/api/search/reindex`)

### 9. Bull Board & Observability
- [x] Protected Bull Board dashboard at `/api/admin/queues`
- [x] Real-time queue metrics: waiting, active, delayed, completed, failed
- [x] Structured logging with Pino and request correlation IDs

### 10. Professional React Frontend (Figma-Inspired)
- [x] Polished SaaS layout: Sidebar navigation, Header with user profile, stats badges
- [x] Google Login screen with clean Outbox Labs / ReachInbox visual hierarchy
- [x] Compose Email / Campaign dialog with CSV upload, recipient preview table, validation indicators
- [x] Scheduled Emails view with search, filter, pagination, cancel actions
- [x] Sent Emails view with preview link modal, error diagnostics, search, pagination
- [x] Slack Integration settings card with real-time status and connect/disconnect buttons
- [x] Toast notifications and accessible keyboard navigation

### 11. Automated Testing Suite
- [x] Backend unit tests (validation, CSV parsing, rate-limiting algorithms, deduplication)
- [x] Backend integration tests (API endpoints, persistence, queue lifecycle, reconciliation)
- [x] Frontend unit & component tests (forms, tables, previews, state)
- [x] End-to-end integration flows (API, worker, real SMTP dispatch, database persistence)

---

## Detailed Execution Phases
- **Phase 0:** Planning, checklist, environment baseline, project layout.
- **Phase 1:** Docker Compose, PostgreSQL schema, Prisma setup, Redis tools.
- **Phase 2:** Authentication (Google OAuth + Session middleware).
- **Phase 3:** API routes, CSV lead upload, Zod schemas, Campaign & Email endpoints.
- **Phase 4:** BullMQ queue, worker, deterministic jobs, restart reconciliation.
- **Phase 5:** Ethereal SMTP integration, multiple senders.
- **Phase 6:** Throughput, minimum inter-send delay, distributed hourly rate limiting.
- **Phase 7:** Slack OAuth, token encryption, deduplicated rate-limit alerts.
- **Phase 8:** Elasticsearch mapping, indexing outbox, search API.
- **Phase 9:** Bull Board live dashboard integration.
- **Phase 10:** Professional React frontend (Vite, Tailwind, Lucide, Figma-inspired).
- **Phase 11:** Full end-to-end integration & frontend-backend connectivity.
- **Phase 12:** Automated test suite execution & fixing.
- **Phase 13:** Restart & failure resilience testing.
- **Phase 14:** Security & code quality review.
- **Phase 15:** Deployment configuration & comprehensive documentation.
- **Phase 16:** Final acceptance gate verification.
