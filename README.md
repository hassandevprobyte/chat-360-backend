# LiveChat API

Backend for a multi-tenant live chat SaaS: a REST API, a Socket.IO realtime layer, background workers and a public widget API — built as a **modular monolith** in Node.js (CommonJS), Express, MongoDB/Mongoose, Redis, Socket.IO and BullMQ.

Two frontends consume it: a **dashboard** (owners and agents) and an **embeddable widget** (anonymous visitors on customer websites).

---

## Contents

1. [Stack](#stack)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Running the API and the workers](#running-the-api-and-the-workers)
5. [Seeding](#seeding)
6. [Testing](#testing)
7. [Domain model](#domain-model)
8. [Authentication](#authentication)
9. [Authorization & tenant isolation](#authorization--tenant-isolation)
10. [Conversation assignment flow](#conversation-assignment-flow)
11. [Message shortcuts](#message-shortcuts)
12. [Internal notes](#internal-notes)
13. [Realtime (Socket.IO)](#realtime-socketio)
14. [Public widget API](#public-widget-api)
15. [Dashboard API](#dashboard-api)
16. [Website domain verification](#website-domain-verification)
17. [Background jobs](#background-jobs)
18. [Attachments](#attachments)
19. [Project layout](#project-layout)
20. [Deliberate scope limits](#deliberate-scope-limits)

---

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js ≥ 20, JavaScript, CommonJS |
| HTTP | Express 4, Helmet, CORS, compression, cookie-parser |
| Validation | Joi (params / query / body; unknown keys stripped) |
| Database | MongoDB 7 via Mongoose 8 |
| Cache / presence / pub-sub | Redis 7 via ioredis |
| Realtime | Socket.IO 4 + Redis adapter |
| Queues | BullMQ |
| Auth | JWT access tokens + rotating opaque refresh tokens, bcrypt |
| Email | Nodemailer + Handlebars templates |
| Files | Local disk or S3-compatible provider (pluggable) |
| Logging | pino (structured, redacted) |
| Docs | OpenAPI 3 served at `/api/v1/docs` |
| Tests | Jest + supertest (in-memory MongoDB, Redis stub) |

---

## Quick start

```bash
git clone … && cd live-chat-api
cp .env.example .env            # then set the three JWT_* secrets at minimum
docker compose up -d            # MongoDB (single-node replica set), Redis, Mailpit
npm install
npm run seed                    # needs SEED_SUPER_ADMIN_EMAIL / _PASSWORD in .env
npm run dev                     # API + Socket.IO on http://localhost:4000
npm run worker:dev              # in a second terminal
```

- Swagger UI: <http://localhost:4000/api/v1/docs>
- Health: <http://localhost:4000/api/v1/health>
- Mailpit (caught emails): <http://localhost:8025>

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Environment variables

Every variable is validated at boot by `src/config/env.js` (Joi). A bad configuration fails fast. See `.env.example` for the full annotated list; the essentials:

| Variable | Purpose |
|---|---|
| `PORT`, `APP_URL`, `DASHBOARD_URL`, `WIDGET_URL` | Public URLs used in links and CORS |
| `CORS_ORIGINS` | Comma-separated origins allowed to call the **dashboard** API. The public widget API is not CORS-restricted; it is origin-checked per website instead |
| `MONGO_URI` | MongoDB connection string. Transactions are used when the server is a replica set and skipped otherwise |
| `REDIS_URL`, `REDIS_PREFIX` | Redis. `REDIS_DISABLED=true` swaps in an in-process stub (tests only) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_WIDGET_SECRET` | Three independent secrets. Widget/visitor tokens can never be mistaken for dashboard tokens |
| `JWT_ACCESS_EXPIRES_IN` (15m), `JWT_REFRESH_EXPIRES_IN` (30d), `JWT_WIDGET_EXPIRES_IN` (7d) | Token lifetimes |
| `REFRESH_COOKIE_ENABLED`, `REFRESH_COOKIE_NAME`, `COOKIE_DOMAIN` | Also deliver refresh tokens as an httpOnly cookie scoped to `/api/v1/auth` |
| `MAIL_DRIVER` (`smtp`\|`log`), `SMTP_*`, `SMTP_FROM` | Email transport |
| `STORAGE_DRIVER` (`local`\|`s3`), `UPLOAD_DIR`, `MAX_FILE_SIZE`, `S3_*` | Attachments |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `PUBLIC_RATE_LIMIT_*`, `BODY_LIMIT` | Rate limiting (Redis-backed, shared across instances) |
| `WIDGET_CONFIG_CACHE_TTL` (300s), `PRESENCE_TTL` (90s) | Redis TTLs |
| `WORKER_CONCURRENCY`, `ENABLE_SCHEDULED_JOBS`, `WORKER_QUEUES` | Worker process tuning |
| `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, `SEED_DEMO`, `SEED_OWNER_*`, `SEED_AGENT_*` | Seed script inputs — never hard-coded |

---

## Running the API and the workers

| Command | What it runs |
|---|---|
| `npm start` / `npm run dev` | `src/server.js` — HTTP API **and** Socket.IO on one port, graceful shutdown on SIGTERM |
| `npm run worker` / `npm run worker:dev` | `src/worker.js` — BullMQ consumers + repeatable jobs. Scale independently; run several |
| `WORKER_QUEUES=email,notifications npm run worker` | Dedicate a worker to specific queues |

The API never processes jobs and the worker never serves HTTP. Workers cannot reach Socket.IO directly, so events they emit are published on a Redis channel that every API instance re-broadcasts locally (`src/realtime/emitter.js`).

MongoDB is the source of truth. Redis holds only ephemeral state (presence, widget config cache, rate-limit counters, socket adapter, queues); losing it degrades nothing durable.

---

## Seeding

```bash
SEED_SUPER_ADMIN_EMAIL=root@example.com SEED_SUPER_ADMIN_PASSWORD='a-long-password' npm run seed
```

Add `SEED_DEMO=true` plus `SEED_OWNER_EMAIL/_PASSWORD` and `SEED_AGENT_EMAIL/_PASSWORD` to also create a demo workspace, a `localhost` website with origin checks disabled, a widget (its public key is printed), three tags and a few shortcuts for both users. The script is idempotent.

---

## Testing

```bash
npm test
```

The suite (`tests/`) uses supertest against the real Express app, `mongodb-memory-server` and `REDIS_DISABLED=true`. No external services are required. Coverage includes:

- auth (register / login / refresh rotation / reuse detection)
- workspace roles, invitations, last-owner protection
- tenant isolation (workspace A can never read, claim, tag or message workspace B; visitors only see their own threads)
- unassigned queue, **concurrent claim race** (N contenders → exactly one 200, the rest 409), implicit claim on first reply, close/reopen, tags
- internal notes never reaching the visitor, cursor pagination, read receipts
- shortcut CRUD, ownership, per-user/per-workspace uniqueness
- public widget config whitelist, origin enforcement, visitor sessions
- attachment MIME/extension/size validation and download scoping
- super admin access and auditing

If the memory-server binary cannot be downloaded in your CI, point the suite at any MongoDB with `TEST_MONGO_URI=mongodb://…`. The atomic-claim race test asserts a MongoDB guarantee and skips itself on emulators that report a non-MongoDB `buildInfo`.

---

## Domain model

```
User ──< WorkspaceMember >── Workspace ──< Website ──< Widget
                                  │
                                  ├──< Visitor ──< Conversation ──< Message
                                  │                    │               └─ attachments[]
                                  │                    └── tags[] ─> Tag
                                  ├──< MessageShortcut (per user, per workspace)
                                  ├──< Notification (per user)
                                  └──< AuditLog
Attachment (workspace-scoped, bound to a message on send)
RefreshToken, AuthToken (sessions / one-time tokens)
```

Key rules baked into the schema layer:

- **There is no Agent collection.** An agent is a `User` with an active `WorkspaceMember` whose `role` is `AGENT`. An `OWNER` is also eligible to handle conversations.
- Workspace roles are exactly `OWNER` and `AGENT`. Platform roles are exactly `USER` and `SUPER_ADMIN`.
- `Conversation.assignedTo === null` means "in the unassigned queue".
- `Message.type === 'INTERNAL_NOTE'` is agent-only, always.
- Every tenant-owned document carries `workspace`, and every repository read is scoped by it. There is intentionally no `findById` without a workspace on tenant collections.

Indexes are defined on each model for the hot paths (inbox by `{workspace, status, lastMessageAt}`, queue by `{workspace, assignedTo, status, lastMessageAt}`, messages by `{workspace, conversation, createdAt}`, unique `{workspace, user, shortcut}`, unique `{workspace, nameKey}` for tags, etc.).

---

## Authentication

**Dashboard users**

- `POST /auth/register`, `POST /auth/login` return `{ accessToken, refreshToken, user, workspaces }`.
- Access tokens are short-lived JWTs (`typ: 'access'`) carrying the user's `tokenVersion`; bumping the version (deactivation, password change) invalidates every issued token immediately.
- Refresh tokens are opaque random strings. Only an HMAC of them is stored. `POST /auth/refresh` rotates the token; presenting an already-rotated token is treated as theft and revokes the whole token family.
- Refresh tokens are also set as an httpOnly cookie scoped to `/api/v1/auth` so SPAs can refresh without storing them.
- Email verification, password reset and invitation links use one-time hashed tokens.

**Widget visitors**

- `POST /public/widgets/{publicKey}/visitors/init` upserts a visitor (by the client's `anonymousId`, if any) and returns a `visitorToken` — a JWT signed with `JWT_WIDGET_SECRET` (`typ: 'visitor'`) that carries the visitor, workspace, website and widget ids.
- Every subsequent widget call sends it as `Authorization: Bearer …` (or `X-Visitor-Token`). The server re-loads the tenant from the token's claims and re-checks the request `Origin` on every call, so a suspended workspace, a deactivated widget or a rotated public key invalidates sessions instantly.

The two verifiers reject each other's `typ`, so a visitor token can never open a dashboard route and vice versa.

---

## Authorization & tenant isolation

Every `/workspaces/:workspaceId/...` route runs `resolveWorkspace` → `resolveWorkspaceMember` (`src/common/middleware/workspaceAccess.js`). The URL's `workspaceId` is only a lookup key; access is decided by the caller's `WorkspaceMember` record, which becomes `req.member`. Controllers and services then receive `{ workspace, actor, member }` and never re-derive tenancy from client input.

Role → capability (v1):

| Action | OWNER | AGENT |
|---|---|---|
| Manage workspace, members, websites, widgets, tags, audit logs | ✓ | – |
| See the unassigned queue and all workspace conversations | ✓ | ✓ |
| Claim / reply / close / reopen / apply tags | ✓ | ✓ (close only for own conversations unless `settings.allowAgentCloseUnassigned`) |
| Assign conversations to *other* members | ✓ | – |
| Own message shortcuts | ✓ | ✓ |

`WorkspaceMember.permissions` is a light extensibility hook for additive grants; OWNER implicitly holds every permission. There are no custom roles.

Super Admins (`platformRole: SUPER_ADMIN`) use `/super-admin/*` only. They can list users and workspaces, suspend/reactivate workspaces, deactivate users and inspect conversations across tenants. Every cross-tenant read is written to the audit log. A workspace OWNER is never a Super Admin.

---

## Conversation assignment flow

1. A visitor starts a conversation from the widget. It is created with `assignedTo: null`, `status: OPEN` — it is in the **unassigned queue**.
2. `conversation.created` is broadcast to the `workspace:{id}` room and a `NEW_CONVERSATION` notification (in-app immediately, email via the queue) goes to **every** eligible member (all OWNERs and AGENTs). Everyone sees the same queue at `GET /conversations/unassigned`.
3. An agent takes it in one of two ways:
   - **Explicit claim** — `POST /conversations/:id/claim`.
   - **Implicit claim** — the first visitor-visible reply (`POST /conversations/:id/messages` with any type except `INTERNAL_NOTE`) claims it as a side effect and records `firstResponseAt`.
4. Both paths use one conditional update: `findOneAndUpdate({ _id, workspace, assignedTo: null }, { $set: { assignedTo, assignedAt } })`. Under a race exactly one caller matches; the others get **409 `ALREADY_ASSIGNED`** (claim) or simply do not change the assignment (reply). Claiming what you already own returns 200 with `meta.claimed=false`.
5. `conversation.assigned` is broadcast to the workspace room so every dashboard drops it from the queue; the assignee gets a `CONVERSATION_ASSIGNED` notification unless they assigned themselves.
6. An OWNER may reassign (`/assign`) or anyone may release their own conversation (`/unassign`) back to the queue.

There is no round-robin, least-busy or auto-assignment. `src/modules/conversations/service/assignment.service.js` is the single place a future strategy would plug into.

---

## Message shortcuts

Canned responses are **per user, per workspace**: the same person has a different `/pricing` in each workspace they belong to, and no one can read another member's shortcuts.

- Stored without the leading slash and lowercased; the API returns both `shortcut` (`pricing`) and `trigger` (`/pricing`).
- Unique on `{ workspace, user, shortcut }` (enforced by index, surfaced as 409 `ALREADY_EXISTS`).
- `GET /message-shortcuts?all=true` returns the caller's full, sorted, bounded list so the dashboard can filter locally as the agent types `/`.
- **Selecting a shortcut only inserts its content into the composer. Nothing is sent until the agent presses Send.** The message endpoint accepts an optional `shortcutId` purely for usage telemetry, recorded at send time.

---

## Internal notes

`INTERNAL_NOTE` messages are visible to owners and agents only. Four independent layers enforce it:

1. The public message schema has no `type` field; the server derives a visitor message's type, so a visitor cannot mint one.
2. Visitor history queries filter on `VISITOR_VISIBLE_MESSAGE_TYPES`.
3. `serializeMessageForVisitor` returns `null` for any internal note that somehow reaches it.
4. Visitor sockets only ever join `visitor:{id}`; internal notes are emitted to `workspace:` and `conversation:` rooms only.

Internal notes never claim a conversation and never count as a first response.

---

## Realtime (Socket.IO)

Socket.IO shares the HTTP server (`/socket.io`). Handshake: `io(url, { auth: { type: 'dashboard' | 'widget', token, workspaceId? } })`.

**Rooms**

| Room | Who joins | Carries |
|---|---|---|
| `user:{userId}` | that user's dashboard sockets | `notification.created` |
| `workspace:{workspaceId}` | members with a proven membership | inbox-level events incl. internal notes, presence |
| `conversation:{conversationId}` | agents viewing a thread | typing, read receipts, thread updates |
| `visitor:{visitorId}` | that visitor's widget sockets | visitor-safe payloads only |

**Server → client events** (`src/realtime/events.js`): `conversation.created|updated|assigned|closed|reopened`, `message.created|updated|read`, `typing.start|stop`, `visitor.online|offline|updated`, `agent.online|away|offline`, `notification.created`, `widget.config_updated`.

**Client → server** — dashboard: `workspace:join`, `workspace:leave`, `conversation:join`, `conversation:leave`, `typing:start`, `typing:stop`, `presence:update {status}`, `presence:heartbeat`. Widget: `typing:start`, `typing:stop`, `activity {page}`, `heartbeat`.

Presence lives in Redis with a TTL; multi-tab agents do not flap offline. Chat delivery is synchronous (HTTP → DB → emit); queues are never on the message path.

---

## Public widget API

Base: `/api/v1/public`. Rate-limited per widget/visitor. Nothing here exposes workspace, website or member data.

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /widgets/:publicKey` | none | Whitelisted widget config (Redis-cached) + live `availability` |
| `POST /widgets/:publicKey/visitors/init` | none | Create/refresh visitor → `visitorToken`, `activeConversation` |
| `PATCH /visitors/me` | visitor | Identify (name, email, phone, metadata) |
| `POST /visitors/me/activity`, `/leave` | visitor | Page tracking / offline |
| `GET /conversations` | visitor | Own conversations |
| `POST /conversations` | visitor | Start (or continue the open one) with a first message; optional pre-chat `visitor` block |
| `GET /conversations/:id`, `/messages` | visitor | Own thread; history never includes internal notes |
| `POST /conversations/:id/messages`, `/read`, `/close` | visitor | Send (reopens if closed), read receipt, close |
| `POST /attachments`, `GET /attachments/:id/download` | visitor | Upload (if `fileUploadEnabled`) / download files from own conversations |

Origin policy: the request `Origin` (or `Referer`) host must match the website's `domain` or `allowedDomains` (wildcards like `*.example.com` supported) unless `website.settings.enforceOriginCheck === false`. Failures return 403 `ORIGIN_NOT_ALLOWED`.

Embed snippet (returned with every widget): `<script src="{WIDGET_URL}/widget.js" data-widget="wk_…" async></script>`.

---

## Dashboard API

Base: `/api/v1`, Bearer access token. Full OpenAPI at `/api/v1/docs` (`src/docs/openapi.json`). Summary:

| Area | Routes |
|---|---|
| Auth | `/auth/register`, `/login`, `/refresh`, `/logout`, `/verify-email`, `/forgot-password`, `/reset-password`, `/resend-verification`, `/change-password`, `/sessions` |
| Me | `GET/PATCH /me` |
| Workspaces | `GET/POST /workspaces`, `GET/PATCH /workspaces/:id`, `/transfer-ownership`, `/presence` |
| Members | `/workspaces/:id/members`, `/members/invite`, `/invitations`, `PATCH/DELETE /members/:memberId`, `POST /invitations/accept` |
| Websites / Widgets / Visitors | CRUD under `/workspaces/:id/websites`, `/widgets` (+ `/rotate-key`), `GET /visitors` |
| Conversations | `GET /conversations`, `/unassigned`, `/counts`, `GET/PATCH /:conversationId`, `/claim`, `/assign`, `/unassign`, `/close`, `/reopen`, `/read`, `PUT /tags`, `POST/DELETE /tags/:tagId` |
| Messages | `GET/POST /conversations/:id/messages`, `PATCH /messages/:messageId` |
| Shortcuts | CRUD under `/workspaces/:id/message-shortcuts` |
| Tags | CRUD under `/workspaces/:id/tags` |
| Attachments | `POST/GET /workspaces/:id/attachments`, `GET /:attachmentId`, `/download`, `DELETE` |
| Notifications | `GET /notifications`, `/unread-count`, `POST /read-all`, `PATCH /:id/read` |
| Audit | `GET /workspaces/:id/audit-logs` (OWNER) |
| Super admin | `/super-admin/users`, `/workspaces`, `/workspaces/:id/{members,suspend,reactivate,conversations}` |

**Conventions**

- Envelope: `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? } }`.
- Cursor pagination (`?limit&cursor&direction`, `meta.pagination.nextCursor`) for conversations, messages, notifications; offset pagination (`?page&limit`) for admin lists.
- Errors: 400 `BAD_REQUEST`, 401 `UNAUTHORIZED|TOKEN_EXPIRED|TOKEN_INVALID|INVALID_CREDENTIALS`, 403 `FORBIDDEN|NOT_WORKSPACE_MEMBER|INSUFFICIENT_ROLE|INSUFFICIENT_PERMISSION|WORKSPACE_SUSPENDED|ACCOUNT_INACTIVE|ORIGIN_NOT_ALLOWED`, 404 `RESOURCE_NOT_FOUND`, 409 `CONFLICT|ALREADY_EXISTS|ALREADY_ASSIGNED`, 413, 415, 422 `VALIDATION_ERROR`, 429 `RATE_LIMITED`.
- Malformed ids are 404, not 500, and never reveal whether an id exists in another tenant.

---

## Website domain verification

Any workspace member can create a `Website` with an arbitrary `domain`, but nothing marks it as *owned* until it's verified. Verification proves control of the domain via one of three interchangeable methods, all backed by a single per-website secret (`verificationToken`, never returned by `GET`/list — only surfaced through the endpoints below).

| Method | Where the token goes | How it's checked |
|---|---|---|
| `DNS_TXT` | A TXT record on the domain: `livechat-site-verification=<token>` | `dns.resolveTxt(domain)`, looking for an exact match |
| `META_TAG` | `<meta name="livechat-site-verification" content="<token>">` in the homepage `<head>` | Fetches `https://domain/` (falls back to `http://`) and pattern-matches the tag |
| `FILE_UPLOAD` | A text file at `https://domain/livechat-verification-<token>.txt` containing only the token | Fetches that URL and compares the trimmed body |

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /workspaces/:id/websites/:websiteId/verification` | member | Instructions for all three methods; issues a token on first call |
| `POST /workspaces/:id/websites/:websiteId/verification/rotate` | WEBSITE_MANAGE | Issues a fresh token and resets status to `UNVERIFIED` |
| `POST /workspaces/:id/websites/:websiteId/verify` | WEBSITE_MANAGE | Runs the live check for one `method` (`DNS_TXT`\|`META_TAG`\|`FILE_UPLOAD`) |

`verificationStatus` moves `UNVERIFIED → VERIFIED` on success or `→ FAILED` on failure; `verify` is idempotent once `VERIFIED` (it returns immediately without re-checking). A failed attempt records a human-readable `lastVerificationError` and `lastVerificationAttemptAt` on the website so the dashboard can explain what went wrong, and both outcomes are audit-logged (`website.verified` / `website.verification_failed` / `website.verification_token_rotated`).

Because `META_TAG` and `FILE_UPLOAD` make an outbound request to a client-supplied domain, the domain's resolved IP is checked against private/loopback/link-local/CGNAT ranges before any request is sent (`assertPublicHostname` in `verification.service.js`), and every fetch has a timeout and a response-size cap. This is deliberately not currently wired into `isOriginAllowed` or widget activation — verification status is informational in v1, an extension point for gating features (e.g. requiring `VERIFIED` before a widget goes live) rather than an enforced precondition.

---

## Background jobs

| Queue | Job | Trigger |
|---|---|---|
| `email` | `send-email` | Any templated email (verification, reset, invitations, new-conversation, new-message, generic) |
| `notifications` | `dispatch-notification` | Email fan-out for in-app notifications (`email.kind`) |
| `cleanup` | `cleanup-expired-sessions` (hourly), `cleanup-stale-visitors` (10 min; also removes day-old orphan uploads), `cleanup-expired-invitations` (hourly) | Repeatable |

Enqueue failures are logged and never fail the originating request. When queues are disabled (tests) emails fall back to direct delivery through the configured transport.

Templates: `src/templates/emails/*.hbs` with a shared layout and `_button` partial.

---

## Attachments

- Multer buffers in memory; nothing is written with a client-supplied name or path.
- Allowed MIME types and matching extensions are listed in `ALLOWED_ATTACHMENT_MIME_TYPES`; the MIME type, the extension and their agreement are all checked (415), plus size (413). The service repeats the checks so non-HTTP callers get them too.
- Storage keys are `workspaces/{workspaceId}/{yyyy}/{mm}/{random}-{safeName}` and never leave the server; clients get API download URLs.
- Uploads are bound to a message on send. Only the uploader can attach their upload, and an upload can be sent once.
- Downloads use `Content-Disposition: attachment` + `nosniff`. Visitors can only download files from their own conversations.
- Swap `STORAGE_DRIVER=s3` for any S3-compatible bucket (`src/services/storage/`).

---

## Project layout

```
src/
  app.js, routes.js, server.js, worker.js
  config/        env (validated), database, redis (+ MemoryRedis stub), socket
  common/        constants, errors, logger, response envelope, middleware, utils, validators
  modules/<name>/
    model/       Mongoose schema + indexes
    repository/  all DB access, always workspace-scoped
    service/     business rules
    controller/  thin request → service → envelope
    schema/      Joi
    routes/      Express router
    serializer.js  API shapes (agent vs visitor variants)
  modules: auth, users, workspaces, websites, widgets, visitors, conversations,
           messages, messageShortcuts, tags, attachments, notifications,
           auditLogs, superAdmin, public
  realtime/      events/rooms, emitter (+ worker bridge), presence, handshake auth, handlers
  jobs/          queues, workers, processors
  services/      email (templates, transport), storage providers
  templates/emails/
  seed/
  docs/openapi.json
tests/
```

Dependency direction is one-way: controllers → services → repositories → models. Services call other modules' services or repositories, never their controllers. `assignment.service` and `hydrate.service` sit beneath both `conversation.service` and `message.service` so the message path can claim without a cycle.

---

## Deliberate scope limits

By design this version does **not** include teams, custom roles, billing, AI/automation, a knowledge base, CRM integrations, or round-robin / least-busy assignment. The code is organised so each would be an added module or strategy rather than a rewrite.
