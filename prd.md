# Product Requirements Document (PRD)
## ReachInbox — Full-Stack Email Job Scheduler

**Document Version:** 1.0  
**Project Type:** Full-Stack Web Application  
**Purpose:** Hiring Assignment  
**Priority:** High  
**Status:** Development Specification

---

# 1. Product Overview

## 1.1 Product Name

ReachInbox — Email Scheduling and Delivery Management Platform

## 1.2 Product Summary

ReachInbox is a full-stack email scheduling platform that enables authenticated users to upload email leads, compose email campaigns, schedule emails for future delivery, and monitor email processing through a centralized dashboard.

The platform uses BullMQ and Redis for persistent background job scheduling, PostgreSQL for reliable relational data storage, Ethereal Email for SMTP testing, and Elasticsearch for searching email records.

It also provides distributed rate limiting, configurable worker concurrency, Slack notifications, Google OAuth authentication, and a live queue monitoring dashboard.

The primary objective is to demonstrate how a reliable email scheduling system can be designed to handle large batches of emails while maintaining persistence, observability, security, and a professional user experience.

## 1.3 Problem Statement

Manually sending emails to multiple recipients at specific times is inefficient and difficult to monitor.

A reliable email scheduling system must address several challenges:

- Scheduling emails accurately for future delivery.
- Processing thousands of scheduled jobs efficiently.
- Preventing duplicate job creation and reducing duplicate delivery risks.
- Preserving jobs when application servers restart.
- Enforcing provider throttling and hourly sending limits.
- Supporting multiple email senders.
- Searching and tracking scheduled, sent, and failed emails.
- Notifying users when sending limits are reached.
- Providing a clear and accessible interface for managing email campaigns.

ReachInbox solves these problems through a persistent, distributed job-processing architecture and an intuitive web dashboard.

---

# 2. Product Vision and Goals

## 2.1 Product Vision

Build a reliable, scalable, and user-friendly email scheduling platform that combines backend engineering best practices with a professional SaaS dashboard.

## 2.2 Primary Goals

1. Allow users to authenticate securely using Google OAuth.
2. Allow users to compose and schedule emails through a dashboard.
3. Support bulk email scheduling using CSV or text lead files.
4. Persist scheduled emails in PostgreSQL.
5. Process scheduled emails using BullMQ and Redis without cron jobs.
6. Support configurable worker concurrency and minimum send intervals.
7. Enforce distributed hourly email limits.
8. Notify connected Slack workspaces when a sender reaches a rate limit.
9. Track email lifecycle states and search records using Elasticsearch.
10. Provide real-time visibility into queue processing.
11. Recover pending jobs after API or worker restarts.
12. Deliver a responsive, professional UI inspired by the supplied Figma design.

## 2.3 Non-Goals

The initial version will not attempt to provide:

- A complete commercial email marketing automation suite.
- A guarantee that an email reaches the recipient's inbox.
- A full CRM or contact management platform.
- Advanced email analytics such as opens, clicks, and bounce tracking.
- A custom SMTP server.
- Unrestricted sending through arbitrary third-party SMTP providers.
- Guaranteed exactly-once email delivery across every possible SMTP crash scenario.

These features may be considered for future versions.

---

# 3. Target Users and Roles

## 3.1 Primary Users

### Email Campaign Manager

A user who needs to upload a list of recipients, compose email content, configure sending limits, and schedule a campaign.

### Operations Administrator

An authorized operator who needs to inspect queues, monitor processing, investigate failed jobs, and understand system performance.

## 3.2 User Roles

| Role | Permissions |
|---|---|
| User | Manage authorized campaigns, recipients, email records, and Slack connection |
| Tenant Admin | Manage tenant users, sender configurations, and tenant settings |
| System Operator | Access protected queue monitoring and operational diagnostics |

The exact permission matrix should be implemented explicitly. A normal user must not automatically receive system-wide administrative privileges.

## 3.3 Authentication

Users authenticate through real Google OAuth 2.0.

After successful authentication, the application creates or retrieves the user's account and establishes a secure application session.

The dashboard displays the authenticated user's name, email address, and avatar.

---

# 4. Scope of the MVP

The initial product must include the following modules:

1. Authentication and user sessions.
2. Email sender management.
3. Campaign creation and email composition.
4. CSV/text recipient upload and validation.
5. Scheduled email management.
6. Sent and failed email tracking.
7. BullMQ background processing.
8. Redis-backed distributed rate limiting.
9. Ethereal SMTP integration.
10. Slack OAuth and notifications.
11. Elasticsearch search.
12. Protected BullMQ dashboard.
13. Responsive React dashboard.
14. Automated testing and recovery verification.
15. Documentation and deployment configuration.

Every module must integrate with the real backend and database. Static mock data must not be used as a substitute for production functionality.

---

# 5. Functional Requirements

## FR-01: Google Authentication

**Priority:** P0 — Critical

### Description

Users must be able to sign in securely using their Google accounts.

### Requirements

- Provide a Google sign-in button.
- Implement the actual Google OAuth flow.
- Validate OAuth state and callback parameters.
- Create or retrieve the user record in PostgreSQL.
- Establish a secure application session.
- Expose an authenticated user endpoint.
- Display the user's name, email, and avatar.
- Support logout and session invalidation.
- Protect private application routes.
- Enforce tenant-level authorization.

### Acceptance Criteria

- A valid Google account can authenticate successfully.
- The authenticated user is redirected to the dashboard.
- Invalid or failed OAuth callbacks are rejected safely.
- Unauthenticated users cannot access protected APIs.
- Logout invalidates the application session.
- One tenant cannot access another tenant's private data.

## FR-02: Email Campaign Creation

**Priority:** P0

### Description

Users can compose an email campaign and configure when and how its recipients are processed.

### Required Fields

- Campaign name, where applicable.
- Email subject.
- Email body.
- Authorized sender.
- Recipient list or uploaded lead file.
- Start date and time.
- Minimum delay between sends.
- Hourly sending limit.

### Requirements

- Validate all required fields.
- Validate scheduling dates and timezone.
- Reject invalid configuration.
- Display a scheduling summary before submission.
- Save campaign and email records in PostgreSQL.
- Return meaningful success and error responses.

### Acceptance Criteria

- A valid campaign can be submitted.
- Invalid forms display clear validation messages.
- The server independently validates all submitted data.
- Each accepted recipient receives a persistent email job record.
- Repeated requests with the same idempotency key do not create duplicate campaigns or email jobs.

## FR-03: CSV and Text Lead Upload

**Priority:** P0

### Description

Users can upload recipient lists in supported CSV or text formats.

### Requirements

- Support CSV and plain-text files.
- Parse email addresses from the actual file contents.
- Normalize addresses where appropriate.
- Validate email syntax.
- Detect duplicate addresses.
- Count valid, invalid, and duplicate entries.
- Display a recipient preview.
- Enforce upload size and batch limits.
- Provide clear errors for malformed files.

### Acceptance Criteria

The interface displays:

- Total entries detected.
- Valid email addresses.
- Invalid entries.
- Duplicate addresses.
- Final number of recipients eligible for scheduling.

Invalid entries must not be silently treated as valid recipients.

## FR-04: Persistent Email Scheduling

**Priority:** P0

### Description

Schedule emails using BullMQ delayed jobs backed by Redis.

### Requirements

- Persist email records in PostgreSQL.
- Create corresponding BullMQ jobs.
- Use deterministic job identifiers and database uniqueness constraints.
- Support future scheduling.
- Maintain the intended scheduled timestamp.
- Recover missing queue jobs using a transactional outbox or equivalent reconciliation mechanism.
- Support cancellation while a job remains safely cancellable.
- Handle API and worker restarts.
- Avoid cron jobs and cron libraries.

### Acceptance Criteria

- Future emails remain scheduled after an API restart.
- Pending jobs are recovered after a worker restart.
- Jobs are not intentionally recreated as new emails after recovery.
- Database and queue states can be reconciled.
- Delayed jobs are processed when eligible.

## FR-05: Email Sending Through Ethereal SMTP

**Priority:** P0

### Description

Send scheduled email messages through Ethereal Email using Nodemailer.

### Requirements

- Support multiple authorized sender configurations.
- Validate SMTP configuration.
- Send the correct recipient, subject, and body.
- Store SMTP submission results.
- Save the Ethereal preview URL when available.
- Track failures and retryable errors.
- Distinguish successful SMTP submission from confirmed recipient delivery.
- Prevent unrestricted retry loops.

### Acceptance Criteria

- A valid email is submitted to the configured Ethereal SMTP service.
- The resulting email record reflects the SMTP outcome.
- A preview URL is stored when provided.
- SMTP failures are recorded with useful diagnostics.
- The application does not claim actual inbox delivery without delivery evidence.

## FR-06: Worker Concurrency and Minimum Send Delay

**Priority:** P0

### Description

Control parallel processing and the minimum interval between email sends.

### Requirements

- Configure worker concurrency through environment variables.
- Enforce a minimum send delay.
- Coordinate sender-specific sending across multiple workers.
- Use Redis-backed atomic reservations or an equivalent distributed mechanism.
- Preserve sending order as far as reasonably possible.
- Avoid unnecessary busy loops.

### Configuration Examples

- `WORKER_CONCURRENCY`
- `MIN_DELAY_BETWEEN_EMAILS_MS`

Actual defaults must be documented and validated at startup.

### Acceptance Criteria

- Worker concurrency can be changed without modifying application code.
- Concurrent workers cannot independently bypass the shared sender delay.
- The minimum interval is enforced according to the documented semantics.
- The system remains stable when many jobs become eligible simultaneously.

## FR-07: Hourly Rate Limiting

**Priority:** P0

### Description

Enforce configurable hourly sending limits globally and/or per sender.

### Requirements

- Support environment-configured hourly limits.
- Use Redis-backed atomic counters or reservations.
- Define a clear hourly-window policy.
- Prevent oversubscription under concurrency.
- Reschedule eligible jobs when limits are reached.
- Preserve recipient ordering where practical.
- Maintain consistent database and queue scheduling information.
- Avoid permanently failing jobs solely because of rate limits.

### Configuration Examples

- `MAX_EMAILS_PER_HOUR_GLOBAL`
- `MAX_EMAILS_PER_HOUR_PER_SENDER`

### Acceptance Criteria

- Limits are respected across concurrent workers.
- A job that reaches the limit remains pending.
- Excess jobs are moved to an eligible future time.
- Jobs are not repeatedly retried in a tight loop.
- Redis reservations are not counted twice during retries.
- The README explains the rate-limit algorithm and its trade-offs.

## FR-08: Slack OAuth and Rate-Limit Notifications

**Priority:** P0

### Description

Allow users to connect Slack and receive actual notifications when sending limits are reached.

### Requirements

- Implement real Slack OAuth.
- Validate OAuth state.
- Store tokens encrypted at rest.
- Associate connections with the correct tenant.
- Display connection status.
- Support disconnect and reconnect.
- Send an actual Slack message on a rate-limit event.
- Deduplicate notifications.
- Handle expired tokens and Slack API failures.
- Avoid crashing email processing when Slack is unavailable.

### Acceptance Criteria

- A user can authorize a Slack workspace.
- A rate-limit event generates a real Slack API notification when connected.
- Repeated events for the same notification key are deduplicated.
- Missing Slack connections do not interrupt email scheduling.
- Connecting Slack later enables subsequent notifications without redeployment.

## FR-09: Elasticsearch Email Search

**Priority:** P0

### Description

Make scheduled, sent, and failed email records searchable through Elasticsearch.

### Searchable Fields

- Recipient email.
- Subject.
- Status.
- Sender.
- Campaign.
- Scheduled timestamp.
- Sent timestamp.
- Tenant identifier.

### Requirements

- Create appropriate index mappings.
- Support full-text and exact-match search.
- Support filters and pagination.
- Enforce tenant isolation.
- Retry failed indexing operations.
- Support rebuilding the search index from PostgreSQL.
- Keep PostgreSQL as the source of truth.

### Acceptance Criteria

- A new email record is eventually indexed.
- Search returns matching records.
- Status updates become searchable.
- Temporary Elasticsearch failures do not cause primary email records to be lost.
- Users cannot search other tenants' records.

## FR-10: Live Queue Monitoring

**Priority:** P0

### Description

Expose a protected BullMQ dashboard for operational visibility.

### Requirements

Display actual queue information, including:

- Waiting jobs.
- Delayed jobs.
- Active jobs.
- Completed jobs.
- Failed jobs.
- Retry information.

### Acceptance Criteria

- Dashboard data reflects the actual BullMQ queue.
- Unauthorized users cannot access operational controls.
- Queue monitoring does not expose credentials or unnecessary sensitive content.

## FR-11: Scheduled Emails Dashboard

**Priority:** P0

### Description

Display scheduled and pending email jobs.

### Required Columns

- Recipient email.
- Subject.
- Sender.
- Scheduled time.
- Status.
- Campaign.

### Requirements

- Search.
- Pagination.
- Filters.
- Sorting.
- Loading state.
- Empty state.
- Error state.
- Refresh behavior.
- Safe cancellation where supported.

### Acceptance Criteria

- The table displays actual backend data.
- Search and filters work.
- Loading and empty states are visually distinct.
- Schedule changes are reflected in the interface.

## FR-12: Sent Emails Dashboard

**Priority:** P0

### Description

Display emails that have been submitted successfully or have failed.

### Required Columns

- Recipient email.
- Subject.
- Sender.
- Sent time.
- Status.
- Error information where applicable.

### Requirements

- Search and pagination.
- Status filters.
- Loading and empty states.
- SMTP preview links when available.
- Clear distinction between SMTP submission and recipient delivery.

### Acceptance Criteria

- Sent and failed records appear with accurate status information.
- Failed emails expose appropriate diagnostic information.
- Search results match the backend.
- No fabricated sent records appear in production mode.

## FR-13: Professional User Interface

**Priority:** P0

### Description

Build a responsive SaaS dashboard inspired by the provided Figma design.

**Design reference:**  
https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f&m=dev

### Required Screens

1. Google login.
2. Main dashboard.
3. Scheduled Emails.
4. Sent Emails.
5. Compose Email.
6. Slack integration settings.
7. Appropriate error and empty states.

### Requirements

- React and TypeScript.
- Tailwind CSS.
- Reusable UI components.
- Responsive desktop, tablet, and mobile layouts.
- Consistent typography and spacing.
- Accessible forms and keyboard navigation.
- Loading skeletons.
- Toast notifications.
- Clear error messages.
- Functional buttons and links.
- No unnecessary visual clutter.

### Acceptance Criteria

- The dashboard is usable on desktop and mobile.
- Core workflows can be completed without dead buttons.
- The design follows Figma where the design is accessible.
- All primary UI data comes from the real backend.

---

# 6. Non-Functional Requirements

## NFR-01: Reliability

- Persist email and campaign records in PostgreSQL.
- Persist queue state in Redis.
- Recover missing queue jobs.
- Handle process restarts.
- Use bounded retry policies.
- Maintain recoverable state transitions.
- Document ambiguous SMTP delivery outcomes.

## NFR-02: Scalability

The system should support at least 1,000 scheduled jobs becoming eligible at approximately the same time in a controlled test.

It must:

- Bound worker concurrency.
- Enforce distributed rate limits.
- Avoid loading entire email batches into memory unnecessarily.
- Paginate API responses.
- Process jobs without losing valid scheduled work.
- Expose queue backlog and failure metrics.

Actual throughput depends on configured limits, SMTP behavior, infrastructure, and available resources.

## NFR-03: Security

- Google OAuth authentication.
- Secure session management.
- Tenant-based authorization.
- Request validation.
- Rate limiting for sensitive APIs.
- Secure secret management.
- Encryption of stored OAuth tokens.
- Safe file uploads.
- Protected queue dashboard.
- Restricted CORS.
- CSRF protection appropriate to the session architecture.
- No secrets in Git or client-side environment variables.
- No sensitive tokens in logs.

## NFR-04: Maintainability

- TypeScript across the frontend and backend.
- Modular architecture.
- Reusable React components.
- Centralized validation and error handling.
- Clear API contracts.
- Database migrations.
- Automated tests.
- Code formatting and linting.
- Environment-driven configuration.

## NFR-05: Observability

- Structured application logs.
- Job correlation IDs.
- Queue metrics.
- SMTP failure information.
- Rate-limit event tracking.
- Slack notification outcomes.
- Elasticsearch indexing failures.
- Health checks for PostgreSQL, Redis, and Elasticsearch.

## NFR-06: Usability and Accessibility

- Clear navigation.
- Consistent interaction patterns.
- Accessible form labels.
- Visible keyboard focus.
- Helpful validation messages.
- Responsive layouts.
- Appropriate contrast.
- Explicit confirmation for destructive actions.

---

# 7. System Architecture

## 7.1 High-Level Architecture

```text
                 React + TypeScript
                   Tailwind CSS
                         |
                         v
                   Express API
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
     PostgreSQL        Redis       OAuth Services
          |              |         Google / Slack
          |              |
          v              v
    Transactional     BullMQ Queue
       Outbox              |
          |                v
          +----------> Email Worker
                           |
                  +--------+--------+
                  |                 |
                  v                 v
              Ethereal SMTP    Rate Limiter
                                    |
                                    v
                              Slack Alerts

     PostgreSQL --------> Indexing Outbox
                                |
                                v
                           Elasticsearch
                                |
                                v
                         Search API / UI

                 Bull Board / Queue Monitoring
```

## 7.2 Architecture Principles

- PostgreSQL is the source of truth for application records.
- Redis and BullMQ manage delayed jobs and distributed processing.
- A transactional outbox or recoverable handoff connects database state with queues.
- Elasticsearch is a rebuildable search index.
- Slack notifications must be recoverable and deduplicated.
- Google OAuth and Slack OAuth must use real external authorization flows.
- All tenant-owned records must be authorized server-side.

---

# 8. Data Model

## 8.1 Core Entities

### User

Stores authenticated Google user information.

### Tenant

Represents an account or workspace boundary.

### Tenant Membership

Associates users with tenants and roles.

### Email Sender

Stores authorized sender identities and references to secure SMTP configuration.

### Campaign

Stores campaign-level subject, body, scheduling, and rate settings.

### Email Job

Stores each recipient's individual scheduled email, status, timing, and processing information.

### Slack Connection

Stores encrypted Slack authorization information for a tenant.

### Outbox Event

Stores pending queue or indexing operations that need reliable delivery.

### Notification Event

Stores notification deduplication keys and delivery outcomes.

## 8.2 Important Constraints

- Unique idempotency key within the appropriate tenant and operation scope.
- Unique provider user ID for Google identity.
- Valid foreign-key relationships.
- Indexed recipient, status, sender, and timestamp columns.
- Tenant-scoped queries.
- Valid lifecycle transitions.
- No plaintext OAuth tokens.

## 8.3 Email Lifecycle

```text
scheduled
    |
    v
queued
    |
    v
processing
   / | \
  /  |  \
 v   v   v
sent failed delivery_unknown
```

A rate-limited email remains pending and is rescheduled rather than permanently failed.

Cancellation is allowed only while the email has not entered an irreversible sending stage.

Retryable errors may move the email back to a queued or retrying state.

The system must document how ambiguous SMTP outcomes are resolved.

---

# 9. API Requirements

The backend should expose versioned, documented REST endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/logout` | End session |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| POST | `/api/emails/schedule` | Schedule recipient emails |
| GET | `/api/emails/scheduled` | List scheduled emails |
| GET | `/api/emails/sent` | List sent emails |
| GET | `/api/emails/:id` | Get email details |
| POST | `/api/emails/:id/cancel` | Cancel an eligible email |
| GET | `/api/search/emails` | Search email records |
| GET | `/api/senders` | List authorized senders |
| POST | `/api/senders` | Configure an authorized sender |
| GET | `/api/slack/connect` | Start Slack OAuth |
| GET | `/api/slack/callback` | Complete Slack OAuth |
| GET | `/api/slack/connection` | Read Slack connection status |
| DELETE | `/api/slack/connection` | Disconnect Slack |
| GET | `/api/queue/stats` | Authorized queue statistics |

The API contract must define request schemas, response schemas, status codes, validation errors, pagination, and authorization rules.

Use an idempotency key for scheduling requests.

---

# 10. Frontend Information Architecture

## 10.1 Login

- Product branding.
- Google sign-in.
- Authentication loading and error states.

## 10.2 Main Dashboard

- Navigation.
- User profile.
- Queue or email metrics.
- Scheduled Emails.
- Sent Emails.
- Compose New Email.
- Slack connection status.

## 10.3 Compose Email

- Sender selection.
- Subject and body.
- File upload.
- Recipient validation summary.
- Start time.
- Minimum delay.
- Hourly limit.
- Schedule action.
- Confirmation and error feedback.

## 10.4 Scheduled Emails

- Searchable and filterable table.
- Pagination.
- Scheduled timestamps.
- Status indicators.
- Cancellation for eligible jobs.

## 10.5 Sent Emails

- Searchable and filterable table.
- SMTP submission status.
- Sent timestamps.
- Failure information.
- Preview link where available.

## 10.6 Integrations

- Slack connection state.
- Connect and disconnect controls.
- Clear OAuth success and failure feedback.

---

# 11. Rate-Limiting Policy

The system must define and document the following configuration:

- Worker concurrency.
- Minimum inter-send delay.
- Global hourly limit.
- Per-sender hourly limit.
- Hour-window timezone.
- Reservation expiry or recovery policy.
- Rate-limit rescheduling behavior.
- Notification deduplication policy.

Redis-backed atomic reservations must be used to prevent concurrent workers from oversubscribing limits.

The scheduling algorithm must determine the next eligible time without dropping jobs.

If a sender's hourly limit is reached, the system must produce a real Slack notification for a connected tenant and continue processing other eligible work safely.

A notification failure must not cause the email to be sent twice or permanently fail the campaign.

---

# 12. Testing and Quality Assurance

## 12.1 Unit Tests

- Email validation.
- CSV parsing.
- Duplicate detection.
- Scheduling calculations.
- Rate-limit calculations.
- Idempotency.
- State transitions.
- Error classification.
- Notification deduplication.
- Search document mapping.

## 12.2 Integration Tests

- Google OAuth callback handling.
- Database persistence.
- Queue creation and reconciliation.
- Worker processing.
- SMTP integration boundaries.
- Redis rate-limit reservations.
- Slack notification handling.
- Elasticsearch indexing.
- Tenant authorization.

## 12.3 End-to-End Tests

- Login and logout.
- Upload recipients.
- Schedule a campaign.
- View scheduled emails.
- Process an email through a controlled SMTP integration.
- View sent and failed emails.
- Search email records.
- Connect Slack and verify notification delivery.
- Recover scheduled work after a restart.

## 12.4 Failure Tests

- API restart.
- Worker restart.
- Redis interruption.
- Database-to-queue handoff failure.
- SMTP transient failure.
- Ambiguous SMTP outcome.
- Elasticsearch outage.
- Slack API outage.
- Rate-limit exhaustion.
- Duplicate schedule requests.
- A 1,000-job synthetic batch.

External services should use controlled test doubles for automated tests and separate real integration tests when credentials are available.

---

# 13. Deployment and Environment Configuration

Provide a reproducible local environment using Docker Compose.

Required services:

- PostgreSQL.
- Redis.
- Elasticsearch.
- Backend API.
- Email worker.
- Frontend.

The project must support separate API and worker processes.

Use environment variables for:

- Database connection.
- Redis connection.
- Elasticsearch connection.
- Google OAuth credentials.
- Slack OAuth credentials.
- SMTP configuration.
- Session secret.
- Encryption key.
- Worker concurrency.
- Minimum send delay.
- Hourly rate limits.
- Frontend and backend URLs.

Include health checks, persistent volumes, database migrations, graceful shutdown, and service startup instructions.

Do not commit real secrets to the repository.

---

# 14. Acceptance Criteria

The project is considered ready for submission when:

1. Google OAuth works with real credentials.
2. Users can compose emails and upload valid recipient files.
3. Scheduling requests persist in PostgreSQL.
4. BullMQ creates persistent delayed jobs.
5. Restart recovery is verified.
6. Duplicate scheduling requests are handled idempotently.
7. Ethereal SMTP submission works with valid configuration.
8. Multiple senders are supported.
9. Worker concurrency is configurable.
10. Minimum send delay is enforced across workers.
11. Hourly limits are enforced using shared state.
12. Rate-limited emails are safely rescheduled.
13. Slack OAuth works with real credentials.
14. Rate-limit events trigger real Slack messages when connected.
15. Elasticsearch indexes and searches email records.
16. The queue dashboard displays actual queue data.
17. Scheduled and sent email pages use real backend data.
18. Frontend and backend workflows are integrated.
19. Automated tests run and results are documented.
20. A synthetic 1,000-job test demonstrates the designed load-handling behavior.
21. Security and tenant-isolation checks pass.
22. README and environment setup documentation are complete.
23. Frontend and backend builds succeed.
24. Any remaining external blockers or known limitations are explicitly documented.

A successful build alone does not satisfy these criteria.

---

# 15. Success Metrics

The following are proposed engineering targets for verification, not claims of achieved performance.

| Metric | Target |
|---|---|
| Data persistence | No acknowledged scheduled record is silently lost |
| Restart recovery | Pending jobs are recovered without creating duplicate logical jobs |
| Rate limiting | No oversubscription in concurrent reservation tests |
| Queue load test | 1,000 synthetic jobs are scheduled and tracked successfully |
| API quality | Validation, authorization, and documented errors work consistently |
| Search | Email records become searchable after indexing succeeds |
| Frontend quality | All primary workflows work on desktop and mobile |
| Test quality | Critical tests pass and failures are reported honestly |
| Security | Tenant isolation and protected administrative access are verified |

SMTP delivery outcomes must be interpreted according to provider evidence. The system must not claim exactly-once delivery or confirmed inbox delivery without sufficient guarantees.

---

# 16. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| API or worker restart | Persistent queue, database records, reconciliation |
| Duplicate job creation | Idempotency keys and unique constraints |
| Ambiguous SMTP result | Explicit uncertain state and controlled recovery |
| Concurrent rate-limit oversubscription | Atomic Redis reservations |
| Slack API outage | Deduplicated, retryable notification workflow |
| Elasticsearch outage | PostgreSQL source of truth and retryable indexing |
| Missing OAuth credentials | Clear configuration instructions and explicit verification status |
| Large recipient uploads | Batch limits, streaming or bounded parsing |
| Tenant data leakage | Server-side authorization and isolation tests |
| Queue dashboard exposure | Authentication and restricted operational access |

---

# 17. Future Enhancements

Potential future releases may include:

- Campaign analytics.
- Delivery, bounce, open, and click tracking.
- More SMTP providers.
- Campaign pause and resume.
- Advanced recurring schedules without cron.
- Tenant-level usage reports.
- Email templates.
- Webhooks.
- Advanced search filters.
- Audit logs.
- Dedicated monitoring and alerting.
- Horizontal worker scaling.
- More advanced scheduling and fairness policies.

These enhancements must not delay completion of the required MVP.

---

# 18. Final Deliverables

The final submission must contain:

1. Complete React frontend.
2. Complete TypeScript Express backend.
3. PostgreSQL schema and migrations.
4. BullMQ queues and worker implementation.
5. Redis-backed rate limiting.
6. Ethereal SMTP integration.
7. Real Google OAuth integration.
8. Real Slack OAuth and notification integration.
9. Elasticsearch indexing and search.
10. Protected queue monitoring dashboard.
11. Docker Compose configuration.
12. Environment variable example file.
13. Automated unit, integration, and end-to-end tests.
14. Comprehensive README.
15. Requirement checklist with actual verification status.
16. Evidence-based final implementation report.

## Final Product Definition

ReachInbox is complete when an authenticated user can upload email leads, schedule an email campaign, observe the resulting persistent BullMQ jobs, process eligible emails through Ethereal SMTP, track their status in the dashboard, search records through Elasticsearch, and receive a real Slack alert when a configured sender reaches its hourly sending limit.

The application must recover pending work after restarts, enforce distributed rate limits, and provide a secure, professional, and responsive user experience.

All completion claims must be supported by implementation evidence and appropriate tests.