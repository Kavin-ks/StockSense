# Architecture

## Request flow

```
React page -> api/endpoints.js -> fetch (JWT) -> Express router
   -> validate(zod) -> requireAuth -> service (business rules, SQL) -> PostgreSQL
   <- JSON  |  errors -> errorHandler -> { error: { message, fields } } -> form shows field errors
```

Each backend module is split into **routes** (HTTP only), **schemas** (input rules) and **service**
(business logic + SQL). Services never touch `req`/`res`, so the seed script and future jobs reuse them directly.

## Data model

```
users ─┬─< password_reset_otps
       └─< operations.responsible_id

warehouses ─< locations (internal)          locations (virtual: vendor, customer, inventory_loss)
     │
     ├─< operation_sequences (next number per warehouse+type -> WH/IN/0001)
     └─< reorder_rules >─ products >─ product_categories

operations ─< operation_lines >─ products
     │
     └─< stock_moves (LEDGER, append-only) >─ products, locations(from/to)

stock_quants (product_id, location_id) = current on-hand, CHECK (quantity >= 0)
```

### Key design decisions

1. **Everything is a move.** Receipts, deliveries, transfers, adjustments and initial stock all become
   `moveStock(from, to, qty)`. Vendors, customers and inventory loss are *virtual locations*, so one
   function handles every flow:

   | Flow | From | To |
   |---|---|---|
   | Receipt | Vendors (virtual) | WH/STOCK |
   | Delivery | WH/STOCK | Customers (virtual) |
   | Internal transfer | WH/RACK-A | WH2/STOCK |
   | Adjustment (+) / (−) | Inventory adjustment ↔ location | |

2. **Ledger + snapshot.** `stock_moves` is the audit trail (never updated). `stock_quants` is the
   current balance, so reads are fast. Both are written in **one transaction**, so they cannot drift apart.
3. **Concurrency safety.** A stock decrement is a conditional `UPDATE … WHERE quantity >= qty`, so two
   validations running at the same time can never drive stock negative. The DB `CHECK` constraint is a
   second safety net. Operations are locked with `SELECT … FOR UPDATE` before a status change, so a
   document can't be validated twice.
4. **References.** `operation_sequences` uses an upsert counter per warehouse and type, which produces
   gap-free references like `WH/IN/0001` and `WH/OUT/0002` without race conditions.
5. **Integrity in the database, not only in code.** The schema enforces unique SKU (case-insensitive),
   unique email (case-insensitive), a 6–12 character login id, non-negative quantities, max ≥ min on
   reorder rules, and source ≠ destination.

## Status machine

```
receipt / internal : draft --(To Do)--> ready --(Validate)--> done
delivery           : draft --(To Do)--> waiting | ready --(Validate)--> done
                     (waiting = some line is not in stock at the source location)
any non-done       : --(Cancel)--> canceled
adjustment         : created as done (counted qty applied immediately)
```

## Roles & permissions

`server/src/config/permissions.js` maps permission names to roles (`manager`, `staff`).
- Routes use `requirePermission('products.write')`. Operation routes check `<type>.manage` (create, edit, cancel) or
  `<type>.process` (To Do, Validate), based on the document's **stored** type.
- `requireAuth` loads `role` and `is_active` from the database on every request (a primary-key lookup), so demotion and
  deactivation apply immediately instead of when the 8-hour JWT expires.
- Account lifecycle is an enum, `users.status`: `pending` (self sign-up, no session issued) → `active` ⇄ `deactivated`.
  `approved_by`/`approved_at` record who let each user in (a CHECK constraint requires `approved_at` for non-pending users).
  Approve and reject lock the row and require `pending`, so two managers handling the same request get a clear 409.
- `users.service.updateUser` locks the active managers (`FOR UPDATE`) before changing a role or status, so the
  "at least one active manager" rule holds even with concurrent requests.

## Live updates

```
service (inside transaction) --publish()--> pg_notify('stocksense_events', {...})
                                            | delivered on COMMIT only
API instance(s) --LISTEN--> EventEmitter --> SSE /api/events/stream --> browser EventSource
                                                                         -> useLiveRefresh(topics) -> refetch
```

- Topics: `operations`, `stock`, `products`, `categories`, `warehouses`, `locations`, `users`.
- `users` events only go to managers and to the affected user. A deactivation sends `revoked` and closes the stream.
- EventSource can't send headers, so the client swaps its session JWT for a **60-second, stream-only token**
  (`purpose: 'events'`). Session tokens are rejected on the stream, and stream tokens are rejected on the API.
- The listener reconnects with backoff and sends `resync`. Clients also reconnect with a fresh token and refetch.
- `refreshDeliveriesForProducts()` runs after every stock change (in the same transaction) to move open deliveries
  between `waiting` and `ready`.
- Edits send `expectedUpdatedAt`. A stale save returns `409`, and the UI offers a reload instead of overwriting silently.

## Security

- bcrypt (cost 12) password hashes. Login responses take the same time for unknown users.
- OTPs: 6 digits, bcrypt-hashed, expire after 10 minutes, at most 5 attempts. The reset request doesn't reveal whether an email exists.
- JWT sessions, `helmet`, CORS locked to the client origin, and a rate limiter on the auth endpoints.
- Every query is parameterised. The one dynamic fragment (stock status) is enum-validated first.
