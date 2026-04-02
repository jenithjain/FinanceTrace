# FinanceTrace API Quick Reference

This file is a quick API reference. For complete architecture and flow details, see `README.md`.

## Base Conventions

- Finance APIs are under `/api/finance/*`
- Protected routes require header:
  - `Authorization: Bearer <financeToken>`
- Standard response shape:
  - success: `{ success: true, message, data }`
  - error: `{ success: false, message, errors? }`

## Authentication

### POST /api/finance/auth/register

Create credentials user.

Behavior:

- viewer request -> active immediately
- analyst/admin request -> pending approval, inactive

### POST /api/finance/auth/login

Credentials login; returns user + finance token.

### GET/POST /api/auth/[...nextauth]

NextAuth session/provider endpoints.

### PATCH /api/auth/onboarding/role

Submit role request from onboarding flow.

## Profile

### GET /api/user/profile

Returns profile-safe user payload including role and KYC/business fields.

## Dashboard

### GET /api/finance/dashboard/summary

Returns:

- totalIncome
- totalExpenses
- netBalance
- totalTransactions

Optional query:

- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`

### GET /api/finance/dashboard/by-category

Returns grouped totals by category/type.

Optional query:

- `startDate`
- `endDate`

### GET /api/finance/dashboard/trends

Returns monthly trends object with `trends` array.

Optional query:

- `startDate`
- `endDate`

### GET /api/finance/dashboard/recent

Returns recent transactions object with `transactions` array.

Optional query:

- `startDate`
- `endDate`
- `limit`

## Transactions

### GET /api/finance/transactions

Role: analyst/admin

Supports filters and pagination.

### POST /api/finance/transactions

Role: admin

Creates transaction record.

### GET /api/finance/transactions/:id

Role: analyst/admin

### PATCH /api/finance/transactions/:id

Role: admin

### DELETE /api/finance/transactions/:id

Role: admin

## Users and RBAC Management

### GET /api/finance/users

Role: admin

### GET /api/finance/users/:id

Role: admin

### DELETE /api/finance/users/:id

Role: admin

### PATCH /api/finance/users/:id/role

Role: admin

### PATCH /api/finance/users/:id/status

Role: admin

### PATCH /api/finance/users/:id/role-request

Role: admin

Approve/reject pending role requests.

### PATCH /api/finance/users/request-role

Role: viewer/analyst/admin

Self-service role request submission.

## Assistant

### POST /api/finance/assistant

Role: analyst/admin

Behavior:

- validates input and rate limits
- loads live dashboard context
- calls Gemini model with strict finance prompt
- returns structured assistant response

## RBAC Summary

- Viewer: dashboard read-only + profile + role request
- Analyst: viewer capabilities + transactions read + assistant
- Admin: full system access
