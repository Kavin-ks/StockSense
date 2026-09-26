# StockSense — Upgrade Roadmap & Enhancement Plan

> Based on a thorough audit of every file in the current codebase at commit `2a3611f`.  
> Organized from **highest impact** → **polish-level** improvements.

---

## Current State Summary

### What's Already Built & Working
| Area | Status |
|---|---|
| Double-entry stock moves (receipts, deliveries, transfers, adjustments) | ✅ Complete |
| Operation lifecycle (DRAFT → WAITING → READY → DONE → CANCELLED) | ✅ Complete |
| Product catalog with SKU, barcode, UOM, categories | ✅ Complete |
| Stock quants (real-time per-location inventory) | ✅ Complete |
| Reorder rules & low-stock alert bell with dismiss/persist | ✅ Complete |
| Dashboard KPIs (summary, velocity, alerts) | ✅ Complete |
| Move history audit trail | ✅ Complete |
| Warehouses & locations management | ✅ Complete |
| JWT auth (signup, login, forgot/reset password) | ✅ Complete |
| User profile with security tab | ✅ Complete |
| Desktop horizontal top navbar with mega-dropdowns | ✅ Complete |
| Mobile slide-over sidebar drawer | ✅ Complete |
| Dark / Light / System theme toggle | ✅ Complete |
| Responsive CSS design system with tokens | ✅ Complete |

---

## 🔴 TIER 1 — Critical (Must-Have for Production / Hackathon Demo)

### 1.1 Role-Based Access Control (RBAC)
**What's Missing:** The `users` table has a `role` column but there is no middleware enforcing permissions. Any authenticated user can create, edit, or delete any resource.

**What to Add:**
- `server/src/middleware/requireRole.js` — Middleware that checks `req.user.role` against allowed roles
- Apply it to destructive routes:
  - Only `MANAGER` can create/edit/delete warehouses, locations, categories
  - Only `MANAGER` can cancel confirmed operations
  - `STAFF` can create drafts but not confirm them
- Frontend: Conditionally hide action buttons based on `user.role` from AuthContext

---

### 1.2 Proper Password Change API
**What's Missing:** The Security & Auth tab in ProfilePage has a password change form, but it currently uses a simulated `setTimeout` — there is no actual backend endpoint for changing a logged-in user's password.

**What to Add:**
- `PUT /api/auth/change-password` endpoint in `auth.routes.js`
- Verify `currentPassword` against stored hash with bcrypt
- Validate new password complexity (min 9 chars, uppercase, lowercase, special char)
- Hash and update in the `users` table
- Return success or appropriate error

---

### 1.3 Profile Photo Upload
**What's Missing:** The profile page shows initials-only avatars. There is no image upload mechanism.

**What to Add:**
- `multer` middleware for file upload handling on the backend
- `PUT /api/auth/me/avatar` endpoint that accepts `multipart/form-data`
- Store images in `/public/uploads/avatars/` or a cloud bucket (S3/Cloudinary)
- Add `avatar_url` column to the `users` table
- Display the actual photo in the profile hero banner and the navbar avatar

---

### 1.4 Data Export (CSV / PDF)
**What's Missing:** No way to export any data from the application.

**What to Add:**
- **CSV Export**: Add a "Download CSV" button to DataTable for Products, Stock, Move History, and Operations list pages
- **PDF Reports**: Generate printable PDF reports for:
  - Individual operation documents (Receipt/Delivery/Transfer forms)
  - Stock valuation summary
  - Low-stock alert report
- Libraries: `json2csv` (backend), `jspdf` + `jspdf-autotable` (frontend), or server-side `puppeteer`

---

### 1.5 Barcode Scanner Integration
**What's Missing:** Products have a `barcode` field but there's no way to scan barcodes.

**What to Add:**
- Use `html5-qrcode` or `quagga2` library for camera-based barcode scanning
- Add a scan button on:
  - Product search bars
  - Operation line item addition (scan to add product to receipt/delivery)
- Auto-fill product details after scan match
- Mobile-first UX with fullscreen camera overlay

---

## 🟠 TIER 2 — High Impact (Significantly Improves the Product)

### 2.1 Real-Time Updates (WebSocket / SSE)
**What's Missing:** Data is only refreshed on page navigation. If two users are working simultaneously, they see stale data.

**What to Add:**
- Server-Sent Events (SSE) or WebSocket endpoint (`/api/realtime/events`)
- Emit events on: operation state changes, stock level updates, new user signups
- Frontend `RealtimeContext` that subscribes and triggers refetches
- Live indicator dot showing connection status

---

### 2.2 Activity Log / Audit Trail
**What's Missing:** `stock_moves` tracks inventory changes, but there's no audit log for user actions (who edited a product, who cancelled an operation, etc.).

**What to Add:**
- `activity_logs` table: `id, user_id, action, entity_type, entity_id, details_json, created_at`
- Log every create/update/delete/state-change across all modules
- New page: `/settings/activity-log` with filterable timeline
- Show recent activity on the dashboard

---

### 2.3 Dashboard Charts & Analytics
**What's Missing:** The dashboard shows KPI cards but no visual charts or trend graphs.

**What to Add:**
- Integrate `recharts` or `chart.js` library
- Charts to add:
  - **Stock value over time** (line chart)
  - **Top 10 products by movement volume** (bar chart)
  - **Operations by status** (donut/pie chart)
  - **Receipts vs Deliveries trend** (area chart, last 30 days)
  - **Warehouse utilization** (stacked bar by location)
- Date range picker for filtering

---

### 2.4 Batch Operations
**What's Missing:** Operations can only be managed one at a time.

**What to Add:**
- Multi-select checkboxes on OperationListPage
- Bulk actions toolbar: "Confirm All", "Cancel All", "Export Selected"
- Backend batch endpoints:
  - `POST /api/operations/batch/confirm` accepting `{ ids: [1, 2, 3] }`
  - `POST /api/operations/batch/cancel`
- Progress indicator for batch processing

---

### 2.5 Search & Global Command Palette
**What's Missing:** No way to quickly search across all entities.

**What to Add:**
- `Ctrl+K` / `Cmd+K` command palette (modal overlay)
- Searches across: Products, Operations, Warehouses, Locations, Move History
- Recent searches and quick actions ("Create Receipt", "New Product")
- Backend: `GET /api/search?q=...` endpoint querying multiple tables

---

### 2.6 Email Notifications for Stock Alerts
**What's Missing:** The mailer utility exists (`server/src/utils/mailer.js`) but is not connected to any automated workflow.

**What to Add:**
- Daily/weekly digest email of low-stock alerts
- Configurable per-user email preferences (already partially in ProfilePage "Alert Triggers" tab)
- Email on operation state changes (e.g., "Your receipt REC-00042 has been confirmed")
- Use `nodemailer` with SMTP or a service like SendGrid/Mailgun

---

## 🟡 TIER 3 — Advanced Features (Differentiators)

### 3.1 Multi-Warehouse Stock Transfer Optimization
**What to Add:**
- Visual stock distribution map across warehouses
- Suggest optimal transfer routes when one warehouse is overstocked and another is understocked
- "Auto-rebalance" button that generates draft transfer operations

### 3.2 Supplier / Vendor Management Module
**What to Add:**
- `vendors` table: `id, name, contact, email, phone, address, lead_time_days, rating`
- Link vendors to products (which vendor supplies which product)
- Track purchase history and vendor performance metrics
- New nav section: **Procurement** → Vendors, Purchase Orders

### 3.3 Customer / Client Module
**What to Add:**
- `customers` table for outbound delivery tracking
- Link delivery operations to specific customers
- Customer order history and delivery performance

### 3.4 Lot / Batch / Serial Number Tracking
**What to Add:**
- `lot_serial` table: `id, product_id, lot_number, serial_number, expiry_date, manufacturing_date`
- Attach lot/serial to stock moves and quants
- Expiry date alerts for perishable goods
- Full traceability: "Where did this specific batch go?"

### 3.5 Returns / Reverse Logistics
**What to Add:**
- New operation type: `RETURN`
- Customer returns (inward) and vendor returns (outward)
- Automatic stock adjustment on return confirmation
- Return reason tracking and analytics

### 3.6 Inventory Forecasting
**What to Add:**
- Calculate average daily consumption per product
- Predict days until stockout based on current velocity
- "Recommended Order Quantity" calculations
- Visual timeline showing projected stock levels

### 3.7 Multi-Currency & Tax Support
**What to Add:**
- Currency field on products and operations
- Exchange rate management
- Tax rate configuration (GST, VAT, etc.)
- Tax-inclusive and tax-exclusive pricing modes

---

## 🟢 TIER 4 — Polish & UX Improvements

### 4.1 Loading Skeletons
**What's Missing:** Pages show blank content while data loads.

**What to Add:**
- Skeleton loader components (pulsating gray boxes) for:
  - DataTable rows
  - Dashboard KPI cards
  - Product detail forms
  - Profile page sections

### 4.2 Empty States with Illustrations
**What's Missing:** Empty list pages show minimal text.

**What to Add:**
- Custom illustrated empty states for each section:
  - "No products yet — Add your first item"
  - "No operations found — Create a receipt to get started"
- Call-to-action buttons in empty states

### 4.3 Keyboard Shortcuts
**What to Add:**
- `Ctrl+K` → Global search
- `Ctrl+N` → New operation/product (context-aware)
- `Ctrl+S` → Save current form
- `Escape` → Close modals/dropdowns
- `?` → Show keyboard shortcut help overlay

### 4.4 Undo / Confirmation Dialogs
**What's Missing:** Destructive actions (cancel operation, delete product) happen instantly.

**What to Add:**
- Confirmation modal: "Are you sure you want to cancel this operation?"
- Undo toast: "Operation cancelled. [Undo]" with 5-second window
- Prevent accidental navigation away from unsaved forms

### 4.5 Breadcrumb Navigation
**What to Add:**
- Breadcrumb trail on detail/form pages:
  - `Dashboard > Operations > Receipts > REC-00042`
  - `Products > Electronics > Laptop Model X`
- Clickable segments for quick navigation

### 4.6 Pagination & Infinite Scroll
**What's Missing:** Large datasets may cause performance issues.

**What to Add:**
- Server-side pagination on all list endpoints: `?page=1&limit=25`
- Frontend pagination controls with page size selector
- Optional infinite scroll mode for mobile

### 4.7 Table Column Customization
**What to Add:**
- Allow users to show/hide columns on DataTable
- Drag-and-drop column reordering
- Persist column preferences in localStorage
- Column-level sorting indicators

### 4.8 Print-Optimized Views
**What to Add:**
- Print stylesheet improvements for operation documents
- "Print" button on operation detail pages
- Clean print layout: company header, line items table, totals, signatures area

### 4.9 Onboarding / First-Run Wizard
**What to Add:**
- Guided setup wizard for new users:
  1. Create your first warehouse
  2. Add locations (racks/bins)
  3. Import or add products
  4. Create your first receipt
- Progress indicator and skip option

### 4.10 Data Import (CSV/Excel)
**What to Add:**
- Bulk product import from CSV/Excel files
- Column mapping UI
- Validation preview before import
- Error report for failed rows

---

## 🔧 Technical Debt & Infrastructure

### T.1 API Rate Limiting Expansion
**Current:** Only auth routes have rate limiting.
**Improve:** Add rate limiting to all API endpoints with tiered limits.

### T.2 Input Sanitization
**Add:** XSS protection with `DOMPurify` on all user-generated text fields.

### T.3 API Response Standardization
**Add:** Consistent envelope format: `{ success: true, data: {...}, meta: { page, total } }`

### T.4 Database Connection Pooling Tuning
**Add:** Configure pool size, idle timeout, and connection retry logic in `pool.js`.

### T.5 Automated Testing
**Add:**
- Backend: Jest + Supertest for API endpoint testing
- Frontend: Vitest + React Testing Library for component tests
- CI/CD: GitHub Actions workflow for lint + test + build on every PR

### T.6 Docker Compose for Full Stack
**Add:** Single `docker-compose.yml` that spins up PostgreSQL + Backend + Frontend together.

### T.7 Environment-Based Configuration
**Add:** Separate `.env.development`, `.env.production`, `.env.test` configs with validation.

### T.8 Error Boundary Component
**Add:** React Error Boundary wrapping the app to catch rendering crashes gracefully instead of blank pages.

### T.9 PWA Support
**Add:** Service worker, manifest.json, and offline-capable shell for mobile users in warehouse environments with poor connectivity.

### T.10 Accessibility (a11y)
**Add:**
- ARIA labels on all interactive elements
- Keyboard navigation for dropdowns and modals
- Focus management on route changes
- Screen reader announcements for toast notifications
- Color contrast compliance (WCAG 2.1 AA)

---

## Priority Implementation Order (Suggested)

| Priority | Item | Effort | Impact |
|---|---|---|---|
| 🔴 1 | Password Change API (1.2) | 1 hour | High — Security |
| 🔴 2 | Role-Based Access Control (1.1) | 3 hours | High — Security |
| 🔴 3 | CSV Export (1.4) | 2 hours | High — Utility |
| 🟠 4 | Dashboard Charts (2.3) | 3 hours | High — Visual |
| 🟠 5 | Global Search Palette (2.5) | 3 hours | High — UX |
| 🟠 6 | Activity Log (2.2) | 4 hours | Medium — Audit |
| 🟢 7 | Loading Skeletons (4.1) | 2 hours | Medium — Polish |
| 🟢 8 | Confirmation Dialogs (4.4) | 1 hour | Medium — Safety |
| 🟢 9 | Breadcrumbs (4.5) | 1 hour | Medium — Navigation |
| 🔴 10 | Barcode Scanner (1.5) | 4 hours | High — WMS |
| 🟠 11 | Real-Time Updates (2.1) | 5 hours | High — Multi-user |
| 🟠 12 | Email Notifications (2.6) | 3 hours | Medium — Alerts |
| 🟡 13 | Vendor Management (3.2) | 6 hours | Medium — Feature |
| 🟡 14 | Lot/Batch Tracking (3.4) | 8 hours | High — Traceability |
| 🟡 15 | Inventory Forecasting (3.6) | 5 hours | High — Intelligence |
| 🔧 16 | Docker Compose (T.6) | 1 hour | High — DevOps |
| 🔧 17 | Automated Tests (T.5) | 8 hours | High — Quality |
| 🔧 18 | Error Boundary (T.8) | 30 min | Medium — Stability |
