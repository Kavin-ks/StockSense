# StockSense: Implementation Guide & Hand-off

This document is written for **a developer or an AI coding agent** who will continue building StockSense.
Read it fully before changing any code. It covers:

1. What the project is and how it will be judged (evaluation criteria)
2. The rules every change must follow
3. The architecture and conventions already in place
4. Every feature: what is done, how it was built, and how it meets the criteria
5. What is still missing, **with exact instructions** for building each piece

Source documents: `docs/StockSense-problem-statement.pdf` (requirements), `docs/StockSense-mockup.excalidraw`
(screen mock-ups), `docs/ARCHITECTURE.md` (data model and design decisions), `README.md` (setup).

---

## 1. The problem

Build a modular **Inventory Management System (IMS)** that replaces manual registers and Excel sheets with a
centralised, real-time app.

- **Target users:** Inventory Managers (incoming/outgoing stock) and Warehouse Staff (transfers, picking, shelving, counting).
- **Core flows:** Products → Receipts (stock in) → Internal transfers (stock moves between locations) →
  Delivery orders (stock out) → Adjustments (fix count mismatches). **Every movement is logged in a stock ledger.**

---

## 2. Evaluation criteria (how the project is judged)

This project is being built for a **hiring hackathon**. The reviewers said clearly that it is **not about coding fast**.
It is about thoughtful design and clean, scalable code. Every change must be judged against these criteria:

| # | Criterion | What the reviewers want | What it means for your code |
|---|---|---|---|
| 1 | **Database design (most important)** | Well-modelled data in a **local relational DB** (PostgreSQL/MySQL), **not** Firebase/Supabase/MongoDB Atlas | New data gets proper tables, foreign keys, CHECK constraints, unique indexes and indexes for common filters. Schema changes go in a **new migration file**. Never store business data in JSON blobs or static files. |
| 2 | **Backend API design** | Clean, well-structured REST APIs | Resource-oriented routes; state changes are explicit actions (`POST /operations/:id/validate`); consistent JSON error shape. |
| 3 | **Minimal third-party APIs** | Build from scratch and avoid external platforms that can break | Don't add SaaS dependencies (no Firebase, Auth0, Supabase, hosted email APIs). Small, well-known libraries are fine. |
| 4 | **Real-time, dynamic data** | Static JSON is OK for prototypes, not for the final product | Every screen reads from the API/DB. No hard-coded lists in the UI. |
| 5 | **Robust input validation** | Users must get clear feedback (e.g. "entered email is invalid") | Validate on **both** client (instant feedback) **and** server (zod, the source of truth). Show errors **next to the field**. |
| 6 | **Graceful error handling** | No crashes, no raw stack traces | Every failure becomes a friendly message. Loading, empty and error states on every screen. |
| 7 | **Proper Git usage** | Version control is a **team sport**: one member pushing everything isn't enough | Small, focused commits with clear messages (`feat(products): …`). Every team member commits their own work. |
| 8 | **Clean, interactive UI** | Consistent colours and layout, intuitive navigation, good spacing | Use the existing design tokens and components. Don't invent new colours or one-off styles. |
| 9 | **Modularity / code patterns** | Modular architecture, reusable code | Follow the module pattern (routes → schemas → service). Reuse components/hooks instead of copy-pasting. |
| 10 | **Performance & scalability** | Works as data grows | Paginate lists, filter/aggregate in SQL (not in JS), add indexes, never load whole tables into the browser. |
| 11 | **Security** | Safe handling of users and data | Parameterised SQL only, hashed secrets, auth on every non-public route, role checks where needed. |
| 12 | **Usability & attention to detail** | Small touches matter | Sensible defaults, confirmations for destructive actions, keyboard support, clear labels. |
| 13 | **Understanding the tools** | "Don't just copy-paste code; understand it" | Keep code readable, and comment the *why* where it isn't obvious. The team must be able to explain every part. |
| 14 | **Trendy tech (optional)** | AI, blockchain or chatbots only if they **genuinely add value** | Don't add them just for show. |

**Quality bar:** only build a feature fully if you can do it at **9/10 or better** on these criteria.
Otherwise build a clean, clearly-marked basic version and list what's missing.

---

## 3. Rules for every change (read before coding)

1. **Never change stock directly.** All stock changes go through `moveStock()` in
   `server/src/modules/stock/stock.service.js`, inside `withTransaction()`. It keeps the ledger (`stock_moves`)
   and current stock (`stock_quants`) in sync.
2. **Schema changes = new migration file** in `server/src/db/migrations/`, numbered after the latest (e.g.
   `002_add_x.sql`). Never edit `001_init.sql` after it has been applied. Run `npm run db:migrate`.
3. **Every endpoint validates input** with a zod schema through the `validate({ body, query, params })` middleware.
   Handlers read validated data from `req.valid.body` / `req.valid.query` / `req.valid.params` (not `req.body`).
4. **Throw `AppError`** (`AppError.badRequest(msg, { field: 'message' })`, `.notFound()`, `.conflict()`, …) for
   expected errors. The central `errorHandler` formats them as `{ error: { message, fields } }`. It also maps
   Postgres unique/foreign-key errors to friendly messages, so add new constraint names to `uniqueMessage()`
   when needed.
5. **Parameterised SQL only** (`$1, $2 …`). Never put user input into a SQL string.
6. **Frontend calls the API only through `client/src/api/endpoints.js`.** Add new routes there.
7. **Forms use the `useForm` hook** (client validation + server field errors). **Lists use `useFetch`** +
   `useQueryState` (filters in the URL) + `DataTable` + `Pagination`.
8. **Style only with the existing CSS tokens/classes** in `client/src/styles/global.css` (`.card`, `.btn-*`,
   `.badge-*`, `.form-grid`, `--primary`, `--danger` …). Light and dark mode both have to keep working.
9. **Commit per feature** with conventional messages: `feat(scope): …`, `fix(scope): …`, `docs: …`.
10. Run `npx vite build` in `client/` before committing and make sure it passes. Restart the API and check the
    endpoint with curl or through the UI.

---

## 4. Architecture recap

**Stack:** PostgreSQL 15 · Node.js + Express 5 (raw SQL via `pg`) · zod · bcryptjs + JWT · React 19 + Vite + React Router 7 · plain CSS.

```
server/src
  config/env.js            validated env config (fails fast)
  db/pool.js               pg pool + withTransaction(fn)
  db/migrate.js            forward-only migration runner
  db/migrations/*.sql      schema
  db/seed.js               demo data created THROUGH the services (ledger stays consistent)
  middleware/              auth.js (JWT, requireAuth, requireRole), validate.js, errorHandler.js
  utils/                   AppError, asyncHandler, schemas.js (shared zod pieces), mailer.js
  modules/<feature>/       <feature>.routes.js  -> HTTP only
                           <feature>.schemas.js -> zod input rules
                           <feature>.service.js -> business logic + SQL (no req/res)
client/src
  api/client.js            fetch wrapper (JWT, ApiError with field errors, 401 -> logout)
  api/endpoints.js         every backend route in one place
  context/                 AuthContext (session), ToastContext (notifications)
  hooks/                   useFetch, useForm, useQueryState, useLookups
  components/              ui.jsx (Field/Input/Select/Button/Modal/...), DataTable, KanbanBoard, Layout, AlertBell
  pages/                   auth/, operations/, products/, settings/, DashboardPage, MoveHistoryPage, ProfilePage
```

**Key data-model idea:** vendors, customers and inventory loss are **virtual locations**. So every flow is
"move qty from location A to location B":

| Flow | From | To |
|---|---|---|
| Receipt | Vendors (virtual) | Warehouse location |
| Delivery | Warehouse location | Customers (virtual) |
| Internal transfer | Location | Location |
| Adjustment / initial stock | Inventory adjustment (virtual) ↔ location | |

**Status machine** (`server/src/modules/operations/operations.service.js`):

```
receipt / internal : draft --confirm("To Do")--> ready --validate--> done
delivery           : draft --confirm--> waiting (stock short) | ready --validate--> done
any not done       : --cancel--> canceled
adjustment         : created directly as done
```

**Demo login:** `demouser` / `Demo@12345` (from `npm run db:seed`).

---

## 5. Features already built: what, how, and why

### 5.1 Authentication — ✅ complete
- **What:** Sign up, sign in, OTP-based password reset, then redirect to the dashboard. Also profile view/edit and logout.
- **Files:** `server/src/modules/auth/*`, `client/src/pages/auth/*`, `client/src/context/AuthContext.jsx`, `components/ProtectedRoute.jsx`.
- **How:**
  - Sign-up rules from the mock-up, enforced on client, server (zod) **and** DB (CHECK/unique index):
    - login ID is 6–12 characters and unique
    - email is valid and unique (case-insensitive)
    - password is more than 8 characters with lowercase, uppercase and a special character
    - confirm password must match
  - A wrong login returns exactly **"Invalid Login Id or Password"**. Unknown users still go through a bcrypt compare,
    so response time doesn't reveal which accounts exist.
  - OTP: 6 random digits (`crypto.randomInt`), stored **bcrypt-hashed**, expires in 10 minutes, at most 5 attempts,
    and all OTPs are marked used after a successful reset. "Forgot password" answers the same way whether or not
    the email exists.
  - Email is sent through your own SMTP server (`SMTP_*` in `.env`). If none is configured, the OTP is printed to the API log.
  - JWT sessions (8h). A rate limiter guards the auth routes (50 requests / 15 minutes / IP). `helmet` and CORS are enabled.
- **Criteria:** validation (5), security (11), no third-party auth service (3).

### 5.2 Dashboard — ✅ complete
- **What:** KPIs: products in stock, low stock, out of stock, pending receipts, pending deliveries, internal
  transfers scheduled. Receipt and Delivery cards ("N to receive", Late, Waiting, Upcoming) as in the mock-up.
  An **Operations by status** grid (document type × status), a filtered operations table, and low-stock alerts.
- **Files:** `server/src/modules/dashboard/*`, `client/src/pages/DashboardPage.jsx`, `client/src/components/FilterBar.jsx`.
- **Filters (all from the PDF):** document type, status, warehouse, **location**, product category. They're stored in the URL.
  - Warehouse / location / category narrow **every** KPI, card and the grid.
  - Document type / status narrow the operations table and **highlight** the matching grid row/column and cards
    (others are dimmed). Clicking a grid cell applies that type + status.
  - KPI cards and "View all" links carry the current filters into the list pages.
- **How:**
  - Two aggregate SQL queries (stock per product; operations grouped by type × status) regardless of data size.
    Late = scheduled date < today and still open.
  - `resolveScope()` in `warehouses.service.js` rejects a location that isn't in the selected warehouse with a
    field error. A location does **not** imply a warehouse filter, so cross-warehouse transfers still appear under
    both warehouses. When only a location is chosen, reorder minimums use that location's warehouse.
- **Same `FilterBar` reused on:** operation lists (status, warehouse, location, category, search, late-only),
  Products/Stock (warehouse, location, category, stock level; quantities are recalculated for the scope),
  and Move History (document type, warehouse, location, category, direction, dates).
- **Criteria:** performance (10), real-time data (4), UI (8), modularity (9: one filter component, one scope resolver).

### 5.3 Products — ✅ complete
- **What:** Create/update products (name, SKU, category, unit of measure, unit cost, **optional initial stock**),
  stock per location, product categories, **reordering rules** (min/max per warehouse), and search by name/SKU.
- **Files:** `server/src/modules/products/*`, `client/src/pages/products/*`.
- **How:**
  - SKU is unique case-insensitively (`UNIQUE INDEX ON upper(sku)`), and the UI shows a friendly message if it's taken.
  - Initial stock is **posted through the ledger** as an adjustment (`WH/ADJ/000N`), never written straight into stock.
  - The list computes on hand, free to use (on hand − qty on open deliveries) and stock status (in/low/out) in one SQL query.
    Filters: category, warehouse, stock level. Paginated.
  - The **Stock** page (`/stock`) is the mock-up's stock screen (product, unit cost, on hand, free to use) with an
    "Update" button that opens an adjustment.
- **Criteria:** DB design (1), scalability (10), modularity (the same list page serves both Products and Stock).

### 5.4 Receipts (incoming goods) — ✅ complete
- **What:** Create a receipt → add supplier and products → quantities → **To Do** (Draft → Ready) → **Validate** → stock goes up.
- **Files:** `server/src/modules/operations/*`, `client/src/pages/operations/OperationListPage.jsx`, `OperationFormPage.jsx`, `LinesEditor.jsx`.
- **How:**
  - The reference is generated automatically as `<Warehouse>/IN/<ID>` (e.g. `WH/IN/0001`) by a race-safe counter per
    warehouse and type (`operation_sequences` upsert).
  - The destination defaults to the warehouse's first location. Responsible defaults to the logged-in user.
  - Validation locks the operation row (`SELECT … FOR UPDATE`), so it can't be validated twice.
  - **Print** uses the browser print dialog with a print stylesheet that hides the navigation.
  - The list has search (reference/contact), filters for status, warehouse, category and late-only,
    **List ↔ Kanban** views, and pagination.
- **Criteria:** API design (2: explicit `/confirm`, `/validate`, `/cancel` actions), DB integrity (1), UI (8).

### 5.5 Delivery orders (outgoing goods) — ✅ mostly complete (see gap G5)
- **What:** Draft → **Waiting** (not enough stock) / **Ready** → Done. Validating reduces stock.
- **How:**
  - On To Do, the system checks availability at the source location and sets `waiting` or `ready`.
  - Lines without enough stock are **shown in red** with "Only X in stock", plus a warning banner (from the mock-up).
  - Stock decrements are atomic (`UPDATE … WHERE quantity >= qty`) and the DB has `CHECK (quantity >= 0)`, so stock
    can never go negative, even with two users validating at once. The user sees
    "Not enough stock of [SKU] Name at the source location".
  - Has delivery address, customer and schedule date fields.

### 5.6 Internal transfers — ✅ complete
- **What:** Move stock between locations, including across warehouses (Main → Production, Rack A → Rack B, WH1 → WH2).
- **How:** Same operation engine: source and destination are both internal locations. Total stock stays the same,
  locations change, and each movement is logged. Validation rejects source == destination on client, server and DB.

### 5.7 Stock adjustments — ✅ complete
- **What:** Pick a location → enter the **counted quantity** per product → the system works out the difference against the
  recorded quantity and posts it.
- **Files:** `client/src/pages/operations/AdjustmentPage.jsx`, `createAdjustment()` in `operations.service.js`.
- **How:** The UI shows "Recorded X → +/−diff" live. The server recalculates inside the transaction (the client's
  numbers are never trusted) and moves the difference to/from the virtual "Inventory adjustment" location.
  The document is stored as `WH/ADJ/000N` with status done.

### 5.8 Move history (stock ledger) — ✅ complete
- **What:** Every movement, with reference, date, product, contact, from, to and quantity. **In = green, out = red.**
- **Files:** `server/src/modules/stock/stock.routes.js`, `listMoves()` in `stock.service.js`, `client/src/pages/MoveHistoryPage.jsx`.
- **How:** Reads the append-only `stock_moves` table. An operation with several products shows one row per product
  (as the mock-up requires). Search covers reference, contact, product and SKU. Filters: direction, warehouse, date range.
  Paginated, with each reference linking back to its document.

### 5.9 Settings: warehouses & locations — ⚠️ basic (see gap G4)
- **What:** Create/edit warehouses (name, short code, address) and locations (name, short code, warehouse).
- **How:** A new warehouse automatically gets a default `STOCK` location. Short codes are unique (DB index).
  Location codes show as `WH/RACK-A`. Editing happens in a modal.
- **Missing:** delete/deactivate.

### 5.10 Additional features
- **Low-stock alerts** — ⚠️ basic: a bell icon in the top bar and a list on the dashboard, driven by reorder rules. No email/push (gap G7).
- **Multi-warehouse** — ✅ everywhere (filters, references per warehouse, cross-warehouse transfers).
- **SKU search & smart filters** — ✅ debounced search, filters stored in the URL (shareable, survive refresh).
- **UX details** — ✅ toasts, loading/empty/error states, responsive layout with a mobile sidebar, dark mode, keyboard-accessible tables/cards, Escape closes modals, code-split routes.

---

## 6. What still needs to be built (with instructions)

Work through these **in order of priority**. For each: follow the rules in section 3, commit separately, and
confirm the acceptance criteria are met.

### G1. Role-based access (Manager vs Staff) — ✅ DONE
Built as described in `README.md` → "Roles" and `docs/ARCHITECTURE.md` → "Roles & permissions":
- `config/permissions.js` (single source of truth), `requirePermission` / `assertCan`
- `modules/users` (list / add / change role / deactivate, with self-change and last-manager guards)
- migration `002_roles.sql`, and `npm run create-manager`
- UI: `can()` in `AuthContext`, Settings → Users, and a role badge.
Also built with it: **live updates** (Postgres NOTIFY + SSE), automatic waiting/ready switching for deliveries, and
optimistic concurrency on operation and product edits.
**Follow-ups:** per-user activity log page; let staff record partial picks (see G5).

### G2. Automated tests — HIGH (criteria: debugging skills, reliability)
- **Build:** Use Node's built-in runner (`node --test`, already set as `npm test`) with a separate test database
  (`DATABASE_URL=postgres://localhost/stocksense_test`). Put tests in `server/test/`.
  - Stock engine: receipt increases stock; delivery decreases it; delivery with too little stock throws and leaves
    **both** `stock_quants` and `stock_moves` unchanged (proves the rollback); adjustment posts the correct +/− difference.
  - Status machine: can't validate a draft; can't validate twice; can't edit a done operation; cancel works.
  - References: two operations in the same warehouse get consecutive numbers.
  - Auth: sign-up validation messages; duplicate login/email; OTP wrong 5 times → blocked.
  - Optionally use `supertest` for HTTP-level tests of `createApp()` (exported from `app.js`).
- **Acceptance:** `npm test` passes from a clean test DB (run migrations in a `before` hook).

### G3. Scalable product picker — MEDIUM (criteria: scalability, usability)
- **Current state:** `LinesEditor.jsx` loads `productApi.list({ pageSize: 100 })` once, so **products after the first 100 can't be picked**.
- **Build:** Replace the `<select>` with a reusable `ProductPicker` component in `components/`: a text input with debounced
  search (`productApi.list({ search, pageSize: 20 })`), a dropdown of results showing `[SKU] Name` and on-hand qty,
  keyboard navigation (↑/↓/Enter/Escape), and the currently selected product shown when editing. Reuse it anywhere a product is chosen.
- **Acceptance:** With 1,000+ products, any product can be found by SKU or name in under a second.

### G4. Delete / archive for warehouses, locations, products, categories — MEDIUM (criteria: completeness, DB integrity)
- **Rule:** **Never hard-delete** anything the ledger references. Use soft delete.
  - `products.is_active` and `locations.is_active` already exist. Add `is_active` to `warehouses` and `product_categories`
    in migration `002_…sql`.
  - Endpoints: `POST /api/products/:id/archive` and `/unarchive` (same for the others). Refuse to archive a location
    or warehouse that still holds stock, with `AppError.conflict('Move the remaining stock out first')`.
  - Lists already filter `p.is_active` for products. Add the same filter for locations/warehouses, and a
    "Show archived" toggle in the UI.
  - Confirm before archiving (use the existing `Modal`).
- **Acceptance:** An archived product no longer appears in pickers, but its history still shows in Move History.

### G5. Delivery pick → pack steps — LOW/MEDIUM (criteria: matches the problem statement)
- **Current state:** The PDF lists "Pick items → Pack items → Validate". The mock-up uses Draft → Waiting → Ready → Done, which is what's built.
- **Build (lightweight):** Add `picked_qty NUMERIC` and `packed_at TIMESTAMPTZ` columns on `operation_lines`/`operations`
  (migration). On a Ready delivery, show a "Pick" checkbox or qty per line and a "Mark packed" button. Only allow
  Validate once packed. Keep the status enum unchanged, or add `'packed'` carefully and update `STATUS_FLOW` in `client/src/utils.js`.
- **Also:** hide **Validate** on a `waiting` delivery until all lines are in stock (right now it's shown and returns a clear error). Show "Check availability", which calls `confirm` again.

### G6. Dashboard filters by document type, status & location — ✅ DONE
See section 5.2. Remaining idea (optional): let the type/status filters also narrow the KPI numbers, instead of only highlighting them.

### G7. Low-stock notifications — LOW (criteria: additional features)
- **Build:** After any validate/adjustment that decreases stock, check the reorder rules for the affected products
  (in `operations.service.js` after the transaction commits) and, for any that dropped to or below the minimum:
  - insert into a new `notifications` table (`id, user_id NULL = all, kind, message, product_id, read_at, created_at`), and
  - optionally email managers through the existing `utils/mailer.js`.
  - Make `AlertBell` read `/api/notifications` (unread count, mark as read), and refresh it every ~60s or after actions.
- **Suggested extra:** a "Create receipt" button on each alert that pre-fills a receipt with `max_qty − on_hand`
  (the reorder rule's max is already stored for this).

### G8. Small polish items — LOW
- **Stock page "Update"** (`ProductListPage.jsx`) opens an empty adjustment. Pass the product id
  (`/operations/adjustments/new?productId=ID`) and pre-fill the first line in `AdjustmentPage.jsx`.
- **Adjustment detail** shows the posted difference without a sign. Show `+`/`−` and colour it (the counted qty and the ledger direction are both available).
- **Profile:** add a "Change password" form (current password + new password with the same rules). Add
  `PUT /api/auth/me/password` and reuse `passwordSchema`.
- **Pagination UI:** add a page-size selector. The API already accepts `pageSize` up to 100.
- **Printing:** add a dedicated print layout for receipts/deliveries (company header, signature lines).

---

## 7. Local setup & verification

```bash
createdb stocksense
cd server && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run dev   # API on :4000
cd client && npm install && npm run dev                                                                  # UI on :5173 (proxies /api)
```

Quick API check:

```bash
curl -s -XPOST localhost:4000/api/auth/login -H 'content-type: application/json' -d '{"loginId":"demouser","password":"Demo@12345"}'
```

Before every commit: `cd client && npx vite build` must pass, and manually test the flow you touched
(including a **bad input** case, to see the field error).

---

## 8. Checklist for every feature you add

- [ ] Data lives in PostgreSQL, with constraints and indexes, added through a new migration
- [ ] zod schema on the server + matching client-side check, and errors shown next to fields
- [ ] Any stock change goes through `moveStock()` inside `withTransaction()`
- [ ] Friendly errors, and loading/empty/error states in the UI
- [ ] Lists are paginated and filtered in SQL
- [ ] Reuses existing components/hooks and design tokens; works in light and dark mode and on mobile
- [ ] Auth (and role) checks enforced on the server
- [ ] Focused commit with a clear message, made by the team member who wrote it
- [ ] `docs/` updated if the architecture or the API changed
