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

Open http://localhost:5173 and sign in with **demouser / Demo@12345** (seeded).

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
