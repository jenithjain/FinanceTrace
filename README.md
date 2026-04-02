# FinanceTrace

FinanceTrace is a Next.js App Router application for finance operations, role-based governance, and analytics reporting.

This document is the source of truth for the current implementation state, architecture, API surface, environment setup, and next-step integration planning.

## Table of Contents

1. Project Scope
2. Current Implementation Status
3. Role and Access Model
4. System Architecture
5. Directory Structure
6. Functional Modules
7. Dashboard Analytics Logic
8. API Catalog
9. Environment and Configuration
10. Local Development
11. Database Seeding and Data Behavior
12. Security and Governance Notes
13. Known Issues
14. Gemini Assistant Integration Strategy
15. Documentation Index

## 1) Project Scope

FinanceTrace currently focuses on:

- Finance dashboard analytics with date-range filtering
- Transaction operations and governance
- User lifecycle management with role requests and approval workflow
- Credentials and Google onboarding with enforced admin approval
- Role-aware UX for viewer, analyst, and admin profiles

Non-goals in the current baseline:

- Automated test suite coverage
- Production-grade distributed rate limiting
- Full AI copilot integration in finance workflows (planned)

## 2) Current Implementation Status

Implemented and active:

- Auth and onboarding pipeline:
  - Credentials signup creates inactive user with pending role request
  - Google sign-in routes to onboarding role selection
  - Admin approval required before dashboard access
- RBAC enforcement:
  - Middleware-based route protection by role
  - Inactive account access blocked server-side
- Dashboard:
  - KPI cards for income, expenses, net, and transaction count
  - Date range presets: This Month, Last 3 Months, This Year, Custom
  - Range-aware summary, category, trends, and recent APIs
  - Tabbed analytics experience with detailed tables
  - Anomaly indicator with drilldown dialog
  - Savings-rate month-over-month context
- Transactions workspace:
  - Analyst/admin listing with filtering and pagination
  - Admin create/update/delete actions
  - CSV export support
- Admin controls:
  - Pending role request review and resolution
  - User role changes, status toggles, and deletion
- Data integrity and seeding:
  - Future-dated transaction exclusion in analytics and listings
  - Non-destructive seed mode plus reset and force options
- Legacy cleanup:
  - Campaign/workflow subsystem removed from active source surface

## 3) Role and Access Model

Roles:

- viewer
- analyst
- admin

Access matrix (effective behavior):

| Capability | Viewer | Analyst | Admin |
|---|---|---|---|
| Dashboard analytics view | Yes (active only) | Yes (active only) | Yes |
| Recent transactions tab in dashboard | No | Yes | Yes |
| Transactions page list/view | No | Yes | Yes |
| Transaction create/update/delete | No | No | Yes |
| User and role management | No | No | Yes |
| Approve/reject role requests | No | No | Yes |

## 4) System Architecture

Logical layers:

- UI layer: App Router pages and role-aware React views
- API route layer: Request parsing, validation handoff, response contract
- Service layer: Business logic and MongoDB aggregation/query orchestration
- Model layer: Mongoose schemas for users, transactions, and analytics entities
- Middleware layer: JWT verification and role checks

Authentication model:

- NextAuth session for web login flow
- Finance JWT for protected finance API calls
- withAuth middleware validates token, user existence, active state, and role access

## 5) Directory Structure

High-level workspace structure:

- app
  - api
    - auth
      - [...nextauth]
      - onboarding/role
    - finance
      - auth
      - dashboard
      - transactions
      - users
    - tmp-images
  - assistant
  - auth
  - dashboard
    - transactions
    - users
  - login
  - onboarding
  - profile
- components
- lib
  - middleware
  - models
  - services
  - validations
- scripts
- public

## 6) Functional Modules

### 6.1 Authentication and Onboarding

Core flows:

- Credentials registration with requested role and inactive status
- Google OAuth followed by explicit onboarding role selection
- Approval-gated activation by admin

Key files:

- app/api/auth/[...nextauth]/route.js
- app/api/auth/onboarding/role/route.js
- app/onboarding/page.js
- app/login/page.js

### 6.2 Finance APIs

Organized under app/api/finance:

- auth: register/login
- dashboard: summary, by-category, trends, recent
- transactions: list/create/update/delete with validation
- users: role request lifecycle, role/status updates, listing and deletion

### 6.3 Dashboard and Analyst Experience

Delivered capabilities:

- Date-range-controlled KPI and chart updates
- Categories tab with both chart and detailed spend table
- Trends tab with chart and month-level table
- Recent Transactions tab with search, date filter, and CSV export
- Anomaly drilldown dialog for flagged high-spend categories

Primary file:

- app/dashboard/page.js

### 6.4 Transactions Workspace

Delivered capabilities:

- Analyst/admin access
- Type/category/date filtering and pagination
- Admin CRUD actions
- CSV export and operation toasts

Primary file:

- app/dashboard/transactions/page.js

## 7) Dashboard Analytics Logic

### 7.1 Date Range Behavior

Data range is controlled by:

- Preset options (this-month, last-3-months, this-year)
- Custom startDate/endDate inputs

Backend behavior:

- Routes pass date params to service layer
- Service normalizes start to start-of-day and end to end-of-day
- End date is capped to end-of-today to avoid future leakage

### 7.2 KPI Calculations

Summary values come from aggregation:

- totalIncome
- totalExpenses
- netBalance = income - expenses
- totalTransactions

### 7.3 Savings Rate

Displayed as:

- Range-level savings rate from summary totals
- Additional month-over-month delta text derived from latest monthly trend row vs previous row

### 7.4 Anomaly Rule (Current)

Current high-spend flag rule in UI layer:

- Compute average expense spend across categories in selected range
- Flag any category where categoryTotal > 1.5 * avgExpensePerCategory
- Compute variance percent for explanation text

This rule is deterministic and range-dependent, not random.

## 8) API Catalog

### 8.1 Authentication

- POST /api/finance/auth/register
- POST /api/finance/auth/login

### 8.2 Dashboard

- GET /api/finance/dashboard/summary
- GET /api/finance/dashboard/by-category
- GET /api/finance/dashboard/trends
- GET /api/finance/dashboard/recent

Supported query parameters on dashboard endpoints:

- startDate: YYYY-MM-DD (optional)
- endDate: YYYY-MM-DD (optional)
- limit (recent only)

### 8.3 Transactions

- GET /api/finance/transactions
- POST /api/finance/transactions
- GET /api/finance/transactions/:id
- PATCH /api/finance/transactions/:id
- DELETE /api/finance/transactions/:id

### 8.4 Users and Role Workflow

- GET /api/finance/users
- GET /api/finance/users/:id
- DELETE /api/finance/users/:id
- PATCH /api/finance/users/:id/role
- PATCH /api/finance/users/:id/status
- PATCH /api/finance/users/:id/role-request
- POST /api/finance/users/request-role

## 9) Environment and Configuration

Required variables:

- MONGODB_URI
- NEXTAUTH_SECRET
- JWT_SECRET

Conditionally required based on enabled features:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GEMINI_API_KEY

Notes:

- JWT_SECRET is mandatory for finance API token verification
- If GEMINI assistant APIs are enabled, GEMINI_API_KEY must be present

## 10) Local Development

Install:

- npm install

Run in development:

- npm run dev

Build and run production mode locally:

- npm run build
- npm run start

Lint:

- npm run lint

## 11) Database Seeding and Data Behavior

Seeder:

- scripts/seed.js

Modes:

- Default: non-destructive (preserve existing transactions)
- --force-transactions: append sample transaction set
- --reset: clear transactions and rebuild sample set

Seed credentials:

- admin@finance.com / Admin@123
- analyst@finance.com / Analyst@123
- viewer@finance.com / Viewer@123

Data safeguards currently implemented:

- Future-dated transactions rejected by validation
- Reporting queries cap upper bound to end-of-today

## 12) Security and Governance Notes

Current safeguards:

- Password hashing with bcryptjs
- JWT auth for finance APIs
- Active-status enforcement in middleware
- Role-based route controls
- Standardized API error responses

Operational considerations:

- In-memory controls are acceptable for local/dev but not for horizontally scaled production
- Replace in-memory controls with Redis-backed implementations for production assistant throttling

## 13) Known Issues

Current lint baseline includes pre-existing issues outside the finance dashboard and API range updates. Examples include:

- unescaped apostrophes in app/not-found.js
- purity warning in app/page.js using Date.now in state init
- existing callback/dependency issues in components/StaggeredMenu.jsx

These are not blockers for dashboard runtime but should be addressed for a fully clean lint baseline.

## 14) Gemini Assistant Integration Strategy

A detailed implementation plan is maintained in:

- docs/ASSISTANT_INTEGRATION_PLAN.md

Summary:

- Current assistant page is UI-only simulation (no real model call)
- Reference integration artifacts provided are valid as a baseline but require adaptation to current token naming, route layout, and dashboard range behavior
- Integration should be done in phased steps: backend route, Gemini client module, frontend hook, assistant page refactor, security hardening, and validation

## 15) Documentation Index

- README.md (this file): architecture and implementation status
- FINANCE_API_README.md: API-oriented deep dive
- docs/ASSISTANT_INTEGRATION_PLAN.md: Gemini assistant integration plan
