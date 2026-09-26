# StockSense — Inventory Management System

A modular IMS that replaces manual registers and spreadsheets with a centralised, real-time app for
**Inventory Managers** (incoming/outgoing stock) and **Warehouse Staff** (transfers, picking, counting).

- Problem statement: [`docs/StockSense-problem-statement.pdf`](docs/StockSense-problem-statement.pdf)
- Mock-up: [`docs/StockSense-mockup.excalidraw`](docs/StockSense-mockup.excalidraw)
- Architecture and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Database | **PostgreSQL 15** (local) | Relational integrity (FKs, CHECKs, enums, partial unique indexes) and transactions for stock. No BaaS. |
| API | **Node.js + Express 5**, raw SQL via `pg` | Every query is readable SQL we fully control. No ORM magic. |
| Validation | **zod** | One schema per endpoint returns field-level messages to the UI. |
| Auth | **bcrypt + JWT**, OTP reset | Stateless sessions. OTPs are hashed, expire, and allow a limited number of attempts. |
| Frontend | **React 19 + Vite + React Router** | Plain CSS design tokens and no UI kit, so the bundle stays small. |

Third-party runtime services: **none**. Email is sent through your own SMTP server when one is configured. Otherwise the OTP is printed to the API log.

## Run locally

Prerequisites: Node 20+ and PostgreSQL 14+.

```bash
createdb stocksense
```

```bash
cd server && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run dev
```

In a second terminal:

```bash
cd client && npm install && npm run dev
```

Open http://localhost:5173. Seeded demo accounts: **demouser / Demo@12345** (Inventory Manager) and
**staffuser / Staff@12345** (Warehouse Staff).

For a real deployment, skip the seed and create your own first manager (see below):

```bash
cd server && npm run create-manager
```

## Roles: Inventory Manager vs Warehouse Staff

The problem statement names two kinds of users. Permissions live in one file,
[`server/src/config/permissions.js`](server/src/config/permissions.js). The API enforces it, and `/auth/me` sends the
resolved list to the UI, so buttons are hidden with exactly the same rules. Every staff member has the same permissions.

| Action | Manager | Staff |
|---|---|---|
| View dashboard, stock, products, documents, move history | ✅ | ✅ |
| Receipts & deliveries: create / edit / cancel (plan incoming & outgoing stock) | ✅ | view only |
| Receipts & deliveries: **To Do + Validate** (shelving received goods, picking for delivery) | ✅ | ✅ |
| Internal transfers (create, edit, validate) | ✅ | ✅ |
| Stock adjustments (physical counts) | ✅ | ✅ |
| Products, categories, reorder rules | ✅ | view only |
| Warehouses & locations | ✅ | view only |
| Users: add members, change role, deactivate | ✅ | ❌ |

- **Public sign-up creates Warehouse Staff.** Managers are promoted by another manager.
- **First manager:** put `MANAGER_LOGIN_ID`, `MANAGER_NAME`, `MANAGER_EMAIL` and `MANAGER_PASSWORD` in `server/.env`
  (git-ignored), then run `npm run create-manager`. Running it again is safe: it updates that manager or resets its password.
- Role changes and deactivation apply **immediately**: the API re-reads the user on every request, and a deactivated user's open tabs are signed out.
- Guard rails: nobody can change their own role or status, and there is always at least one active manager
  (checked under row locks, so two managers acting at the same moment can't break it).

## Live updates (no refresh needed)

When anyone saves, every open screen for every user updates within a moment. For example, a staff member validates a receipt
and the manager's dashboard, stock page and delivery list refresh on their own.

- **How:** services call `publish()` inside their database transaction, which runs `pg_notify`. **PostgreSQL delivers the
  notification only when the transaction commits**, so a failed or rolled-back action never tells anyone that stock changed.
  Each API instance `LISTEN`s and streams events to browsers over **Server-Sent Events** (`/api/events/stream`).
  There's no Redis or third-party service, and it keeps working when the API runs on several servers.
- **Browser:** one connection per tab, with a "Live" indicator in the top bar. Pages subscribe to topics (`operations`, `stock`,
  `products`, …) and refetch in the background. After a disconnect the tab reconnects and refetches whatever it missed.
- **Deliveries react to stock:** when stock arrives, *Waiting* deliveries become *Ready* on their own. When stock leaves,
  affected *Ready* deliveries go back to *Waiting*.
- **No lost edits:** if someone changes a document or product while you're editing it, your unsaved input is kept and
  you get a "Reload" notice. Saving over their change is refused with `409` (optimistic concurrency on `updatedAt`).

## Project layout

```
server/src
  config/        env validation (fail fast on bad config)
  db/            pool + transaction helper, migration runner, SQL migrations, seed
  middleware/    auth (JWT), validate (zod), central error handler
  utils/         AppError, asyncHandler, shared zod schemas, mailer
  modules/       one folder per feature: *.routes.js -> *.service.js (+ *.schemas.js)
    auth/  warehouses/  products/  operations/  stock/  dashboard/
client/src
  api/           fetch client + one endpoints map
  context/       Auth + Toast providers
  hooks/         useFetch, useForm, useQueryState (filters in URL), useLookups
  components/    ui kit (Field, Button, Modal…), DataTable, KanbanBoard, Layout
  pages/         auth/, operations/, products/, settings/, dashboard, moves, profile
```

## API overview

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/signup` · `/login` · `/forgot-password` · `/reset-password` | Auth + OTP reset |
| GET/PUT | `/api/auth/me` | Profile |
| GET | `/api/dashboard/summary?warehouseId&categoryId` | KPIs |
| GET | `/api/dashboard/alerts` | Low-stock alerts (reorder rules) |
| CRUD | `/api/warehouses`, `/api/locations`, `/api/categories` | Settings |
| CRUD | `/api/products` (+ `/:id/reorder-rules`) | Products, stock per location, reorder rules |
| GET/POST/PUT | `/api/operations` | Receipts / deliveries / internal transfers |
| POST | `/api/operations/:id/confirm` · `/validate` · `/cancel` | Status transitions |
| POST | `/api/operations/adjustments` | Physical count → auto adjustment |
| GET | `/api/moves` | Stock ledger (move history) |
| GET/POST/PATCH | `/api/users` | Team management (managers only) |
| POST · GET | `/api/events/token` · `/api/events/stream?token=` | Live updates (Server-Sent Events) |
