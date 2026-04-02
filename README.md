# FinanceTrace - https://financetrace-jenith.vercel.app

**A role-based finance operations platform built for real-world access control, live analytics, and AI-assisted financial insights.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/atlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Demo Video:

https://github.com/user-attachments/assets/7c0a1973-17aa-4a6a-bf61-c4ba738f2ba3


## What is FinanceTrace?

FinanceTrace is a full-stack finance dashboard where organizations track income, expenses, and financial trends — with strict role-based access control baked in at every layer.

Different users interact with the system differently:

- **Admin** — manages transactions, users, and access approval workflows
- **Analyst** — views all financial data, exports reports, queries the AI assistant
- **Viewer** — reads the dashboard summary, category breakdowns, and monthly trends

Access is enforced at two independent levels. The UI hides controls the current role cannot use. The API independently rejects unauthorized requests — bypassing the frontend doesn't grant access.

---

## Live Demo & Repository

| | |
|---|---|
| **GitHub** | https://github.com/jenithjain/FinanceTrace |
| **Deployed App** | https://financetrace-jenith.vercel.app |
| **API Base URL** | https://financetrace-jenith.vercel.app/api/finance |

**Seeded test accounts:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@finance.com | Admin@123 |
| Analyst | analyst@finance.com | Analyst@123 |
| Viewer | viewer@finance.com | Viewer@123 |

---

## Table of Contents

1. [Features](#features)
2. [Role Permission Matrix](#role-permission-matrix)
3. [Tech Stack](#tech-stack)
4. [System Architecture](#system-architecture)
5. [Authentication](#authentication)
6. [Database Design](#database-design)
7. [Dashboard Analytics](#dashboard-analytics)
8. [AI Assistant](#ai-assistant)
9. [API Reference](#api-reference)
10. [Setup & Local Development](#setup--local-development)
11. [Environment Variables](#environment-variables)
12. [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)
13. [Known Notes](#known-notes)

---

## Features

### Dashboard & Analytics — All Roles
- Live KPI cards: Total Income, Total Expenses, Net Balance, Transaction Count
- Category-wise spending breakdown with chart and table
- Monthly income vs. expense trend chart
- Recent transaction activity feed
- Date range presets: This Month, Last 3 Months, This Year, Custom Range
- Savings rate with month-over-month comparison
- Anomaly detection — high-spend categories flagged when they exceed 1.5× the category average

### Transaction Workspace — Analyst & Admin
- Paginated transaction list with filters by type, category, and date
- Full transaction detail view
- CSV export of filtered data

### Transaction Management — Admin Only
- Create, edit, and soft-delete financial records
- Zod-validated inputs with field-level error messages
- Soft delete preserves audit history — records are never permanently removed

### AI Assistant — Analyst & Admin
- Natural-language interface for querying financial data
- Every answer is grounded in live database values — no guessing or hallucination
- Powered by Google Gemini 2.5 Flash
- Rate-limited to 15 requests per minute per user

### User & Access Management — Admin Only
- View all users with their current roles and account status
- Approve or reject role upgrade requests
- Change any user's role or activate/deactivate accounts
- Auto session refresh — approved users are updated within 30 seconds, no forced logout

---

## Role Permission Matrix

| Capability | Viewer | Analyst | Admin |
|---|:---:|:---:|:---:|
| View dashboard KPIs | ✅ | ✅ | ✅ |
| View category totals & trends | ✅ | ✅ | ✅ |
| View recent activity | ✅ | ✅ | ✅ |
| View transactions list & details | ❌ | ✅ | ✅ |
| Export transactions as CSV | ❌ | ✅ | ✅ |
| Use AI Assistant | ❌ | ✅ | ✅ |
| Create transactions | ❌ | ❌ | ✅ |
| Edit transactions | ❌ | ❌ | ✅ |
| Delete transactions | ❌ | ❌ | ✅ |
| View all users | ❌ | ❌ | ✅ |
| Approve / reject role requests | ❌ | ❌ | ✅ |
| Change user role or status | ❌ | ❌ | ✅ |
| Submit a role upgrade request | ✅ | ✅ | ❌ |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16 App Router | Unified frontend and API routes in one project |
| Language | JavaScript (Node.js) | Fast development, strong ecosystem |
| Database | MongoDB Atlas | Aggregation pipeline is well-suited for financial analytics |
| ODM | Mongoose | Schema validation, query helpers, pre-save hooks |
| Auth | NextAuth + JWT | NextAuth for sessions/OAuth; JWT for stateless API auth |
| Validation | Zod | Type-safe schema validation with clean field-level errors |
| AI | Google Gemini 2.5 Flash | Fastest Gemini model; grounded using injected live data context |
| UI | Tailwind CSS + Radix UI | Accessible, composable components |
| Charts | Recharts | Composable React chart library |

---

## System Architecture

```
Request from Client
       │
       ▼
┌──────────────────────┐
│  Next.js Middleware  │  ← Checks authentication & page-level access
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   API Route Layer    │  ← Parses request, validates input with Zod
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  withAuth Middleware │  ← Verifies JWT, checks active status, enforces role
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Service Layer     │  ← Business logic and MongoDB aggregations
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Model Layer       │  ← Mongoose schemas define shape and constraints
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    MongoDB Atlas     │
└──────────────────────┘
           │
           ▼
  { success, message, data }
```

Routes don't contain business logic. Services don't parse HTTP requests. Each layer can be understood, tested, and changed independently.

---

## Authentication

FinanceTrace uses two complementary auth mechanisms.

### NextAuth Session
Handles the web login experience — credentials login, Google OAuth, session lifecycle, and page-level redirects.

### Finance JWT Token
A separate token issued at login, required on every protected API call:

```
Authorization: Bearer <financeToken>
```

This keeps the finance API stateless and independently testable without a browser session.

### Signup Flows

**Viewer** — Account activates immediately. User can log in and view dashboard data from the first session. Role upgrades can be requested from the profile page.

**Analyst / Admin** — Account is created with status `pending`. User sees a waiting screen until an admin approves the request. Once approved, the session refreshes automatically within 30 seconds — no logout required.

**Google OAuth** — First-time Google login creates an active viewer account immediately. The user can then request analyst or admin access from their profile.

---

## Database Design

### User Schema

| Field | Type | Notes |
|---|---|---|
| `name` | String | Full name |
| `email` | String | Unique, lowercase |
| `password` | String | bcrypt hashed — never returned in responses |
| `role` | Enum | `viewer` / `analyst` / `admin` |
| `status` | Enum | `active` / `inactive` |
| `requestedRole` | String | Role the user has requested |
| `roleRequestStatus` | Enum | `none` / `pending` / `approved` / `rejected` |
| `authProvider` | String | `credentials` / `google` |
| `hasCompletedKYC` | Boolean | Profile completion flag |

### Transaction Schema

| Field | Type | Notes |
|---|---|---|
| `amount` | Number | Must be positive |
| `type` | Enum | `income` / `expense` |
| `category` | String | e.g. Salary, Rent, Food, Healthcare |
| `date` | Date | Transaction date |
| `notes` | String | Optional description |
| `createdBy` | ObjectId | Reference to User |
| `isDeleted` | Boolean | Soft delete flag — defaults to `false` |

**Why soft delete?** Permanently removing financial records creates audit gaps. `isDeleted: true` hides records from all standard views while preserving the history. Every query filters `isDeleted: false` automatically.

**Why MongoDB?** The aggregation pipeline handles grouping by category, summing by month, and computing net balances cleanly without complex joins. The transaction schema is naturally document-shaped.

---

## Dashboard Analytics

All dashboard figures come from MongoDB aggregation pipelines — not JavaScript calculations on fetched raw data. The database does the heavy lifting.

### Date Range Handling
- All dashboard APIs accept `startDate` and `endDate` query params
- Start date normalized to `00:00:00` of that day
- End date normalized to `23:59:59` of that day
- End date capped to today — future-dated transactions never appear in reports

### Endpoints

| Endpoint | Returns |
|---|---|
| `GET /dashboard/summary` | `totalIncome`, `totalExpenses`, `netBalance`, `totalTransactions` |
| `GET /dashboard/by-category` | Category name, total amount, count, type |
| `GET /dashboard/trends` | Monthly income and expense totals for the period |
| `GET /dashboard/recent` | Latest transactions with creator details |

### Anomaly Detection
A category is flagged as a high-spend anomaly when its total exceeds **1.5× the average** spend across all expense categories in the selected date range. The variance percentage is shown in the drilldown view.

### Savings Rate
Calculated as `(income - expenses) / income × 100`. A month-over-month delta is computed by comparing the latest monthly trend entry against the previous month.

---

## AI Assistant

Analysts and admins can ask plain-English questions about the finance data and receive answers grounded in live database values.

### How It Works

1. User sends a question — e.g. *"Which category had the highest spending this month?"*
2. System fetches live data from all four dashboard APIs simultaneously
3. That real data is injected as context into a structured prompt
4. Gemini 2.5 Flash answers based strictly on the provided data
5. Response is returned to the chat UI

Gemini is not connected to the database directly. Without injecting live data as context, it would have no basis for accurate figures. Fetching fresh data on every request ensures every answer reflects the actual current state of the database.

### Constraints
- Available to **Analyst** and **Admin** roles only
- Rate-limited to **15 requests per minute** per user
- In-memory rate limiting is used currently — Redis recommended for multi-instance production deployments

### Endpoint
```
POST /api/finance/assistant
```

```json
// Request
{
  "message": "Which category had the highest expenses this month?",
  "conversationHistory": []
}

// Response
{
  "message": "Based on your current data, Rent is the highest expense category at ₹79,000...",
  "role": "assistant",
  "timestamp": "2025-04-02T10:00:00.000Z"
}
```

---

## API Reference

### Standard Response Format

```json
// Success
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}

// Error
{
  "success": false,
  "message": "What went wrong",
  "errors": {}
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request / validation failed |
| `401` | Missing or invalid token |
| `403` | Valid token but wrong role or inactive account |
| `404` | Resource not found |
| `409` | Conflict — e.g. email already exists |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

### Auth Endpoints

#### `POST /api/finance/auth/register`
Create a new user account.

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePass@123",
  "requestedRole": "analyst"
}
```

Viewer accounts activate immediately. Analyst and Admin requests are created as `pending` and require admin approval.

---

#### `POST /api/finance/auth/login`
Authenticate and receive the finance JWT token.

```json
// Request
{ "email": "jane@example.com", "password": "SecurePass@123" }

// Response
{
  "token": "eyJ...",
  "user": { "name": "...", "email": "...", "role": "...", "status": "..." }
}
```

---

### Dashboard Endpoints

All dashboard endpoints require authentication and support optional date filtering via `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.

**Roles: viewer, analyst, admin**

| Endpoint | Description |
|---|---|
| `GET /api/finance/dashboard/summary` | Total income, expenses, net balance, transaction count |
| `GET /api/finance/dashboard/by-category` | Per-category totals and counts |
| `GET /api/finance/dashboard/trends` | Monthly income vs expense breakdown |
| `GET /api/finance/dashboard/recent` | Latest transactions (`?limit=10`) |

---

### Transaction Endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/finance/transactions` | Analyst, Admin | Paginated list — filter by `type`, `category`, `startDate`, `endDate`, `page`, `limit` |
| `POST` | `/api/finance/transactions` | Admin | Create a transaction |
| `GET` | `/api/finance/transactions/:id` | Analyst, Admin | Get single transaction |
| `PATCH` | `/api/finance/transactions/:id` | Admin | Partial update (any field except `createdBy`) |
| `DELETE` | `/api/finance/transactions/:id` | Admin | Soft delete — sets `isDeleted: true` |

**Create / Update body:**
```json
{
  "amount": 50000,
  "type": "income",
  "category": "Salary",
  "date": "2025-04-01",
  "notes": "April salary credit"
}
```

---

### User Management Endpoints

All require Admin role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/finance/users` | All users, no passwords. Supports `?status=active` |
| `GET` | `/api/finance/users/:id` | Single user |
| `DELETE` | `/api/finance/users/:id` | Delete user (cannot delete yourself) |
| `PATCH` | `/api/finance/users/:id/role` | Change role — `{ "role": "analyst" }` |
| `PATCH` | `/api/finance/users/:id/status` | Change status — `{ "status": "inactive" }` |
| `PATCH` | `/api/finance/users/:id/role-request` | Approve/reject — `{ "action": "approve" }` |
| `PATCH` | `/api/finance/users/request-role` | Self-service role request (Viewer, Analyst) — `{ "requestedRole": "analyst" }` |

---

## Setup & Local Development

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Google Cloud project with OAuth credentials *(optional — for Google login)*
- Gemini API key *(optional — for the AI assistant)*

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/your-username/FinanceTrace.git
cd FinanceTrace
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment**

Create `.env.local` in the project root — see [Environment Variables](#environment-variables) below.

**4. Seed the database**
```bash
node scripts/seed.js
```

Creates three test accounts and sample transactions across multiple categories and months so charts and trends display real data from the first login.

```bash
node scripts/seed.js                       # Non-destructive, preserves existing data
node scripts/seed.js --force-transactions  # Appends sample transactions
node scripts/seed.js --reset               # Clears and rebuilds all sample data
```

**5. Start the dev server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `NEXTAUTH_SECRET` | ✅ | NextAuth session encryption key |
| `JWT_SECRET` | ✅ | Finance API token signing key |
| `JWT_EXPIRES_IN` | No | Token expiry — defaults to `7d` |
| `NEXT_PUBLIC_APP_URL` | No | Base URL for internal API calls |
| `GOOGLE_CLIENT_ID` | If using Google OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | If using Google OAuth | Google OAuth client secret |
| `GEMINI_API_KEY` | If using AI Assistant | Google Gemini API key |
| `GEMINI_MODEL` | No | Model name — defaults to `gemini-2.5-flash-preview-05-20` |

---

## Design Decisions & Tradeoffs

### MongoDB over a relational database
The aggregation pipeline handles the dashboard analytics queries — grouping by category, summing by month, computing net balance — more cleanly than equivalent SQL joins for this use case. The schema is naturally document-shaped for transaction records.

### Soft delete
Financial records should never be permanently removed — doing so creates audit gaps. `isDeleted: true` hides records from standard operations while preserving history. The tradeoff is that every query must explicitly filter `isDeleted: false`.

### Dual authentication model
NextAuth manages browser sessions and OAuth while a separate JWT handles finance API calls. This keeps the API stateless and independently testable without a live browser session. The cost is two tokens to manage, but the separation of concerns is worth it.

### AI context fetched per request
The assistant fetches fresh dashboard data on every call so answers are always grounded in the current database state. This adds a small amount of latency per request but eliminates the risk of stale or fabricated figures.

### In-memory rate limiting
Simple and zero-dependency — appropriate for single-instance deployment. For production systems running multiple server instances, Redis-backed rate limiting is the right replacement.

### Viewer immediate activation
Viewer accounts have read-only access to aggregated data with no write capabilities, so waiting for approval adds friction without improving security. Analyst and Admin requests require approval because those roles access transaction-level detail or have write access.

---

## Known Notes

- ESLint reports a warning for direct `<img>` tag usage on the home page. This doesn't affect functionality.
- A browser field mapping package warning may appear in local terminal output. This is a tooling cosmetic issue with no runtime impact.
- In-memory rate limiting for the AI assistant resets on server restart. Redis is the recommended production replacement.

---

## Extra Features

Beyond the core platform, the following were added to improve real-world usability:

- **Google OAuth with role onboarding** — users signing in with Google choose their intended role during first-time setup
- **Admin approval workflow** — analyst and admin access goes through a structured review rather than being auto-granted
- **AI financial assistant** — natural-language querying of live financial data via Gemini 2.5 Flash
- **CSV export** — filtered transaction data exportable for external analysis
- **Anomaly detection** — high-spend categories flagged automatically with variance percentage in drilldown
- **Savings rate with MoM delta** — not just the current rate, but how it changed vs. the previous month
- **Auto session refresh on approval** — no forced logout; sessions update within 30 seconds of admin approval
- **Date range filtering across all dashboard APIs** — consistent filtering for summary, category, trends, and recent activity

---

## Documentation Index

| File | Purpose |
|---|---|
| `README.md` | This file — full architecture, setup, and API reference |
| `FINANCE_API_README.md` | Quick API reference for developers |
| `docs/ASSISTANT_INTEGRATION_PLAN.md` | AI assistant design and operating notes |
