# Finance Assistant Integration

This document reflects the **current implementation** of the Finance Assistant in this repository.

## Status

- Backend assistant API is implemented and running under the finance API namespace.
- Frontend assistant page is integrated with the live API (not mock-only).
- Role-based restrictions are active (viewer cannot access assistant features).
- Assistant output is grounded with dashboard finance context.

## Architecture

### Frontend

- `app/assistant/page.js`
  - Main chat UI.
  - Uses live assistant hook for sending messages and loading/storing chat threads.
- `hooks/useFinanceAssistant.js`
  - Manages request lifecycle, thread state, and persistence behavior.
  - Central place for frontend assistant state.

### Backend

- `app/api/finance/assistant/route.js`
  - Auth-guarded route handler.
  - Validates role and request shape.
  - Fetches/uses finance context and builds structured prompt input.
  - Calls Gemini helper with fallback strategy.
  - Applies safety constraints and basic in-memory rate limiting.
- `lib/gemini.js`
  - Gemini model invocation utility.
  - Handles model fallback when a preferred model is unavailable.

### Auth and RBAC

- `app/api/auth/[...nextauth]/route.js`
  - Session/JWT behavior includes role synchronization for approval updates.
- `middleware.js`
  - Route-level role guard for assistant and privileged finance routes.
  - Explicit bypass for API/static asset handling where needed.

## Access Rules

- `viewer`
  - Read-only app usage.
  - No assistant access.
- `analyst`
  - Assistant access enabled after approval/activation.
- `admin`
  - Assistant access enabled.

## API Contract (Assistant)

- Endpoint: `POST /api/finance/assistant`
- Request body (typical):
  - `message` (string)
  - optional thread metadata
- Response (typical):
  - assistant reply text
  - optional context metadata

Refer to `FINANCE_API_README.md` for broader finance endpoint coverage.

## Reliability Notes

- Model fallback is implemented to reduce failures from unavailable preview models.
- Session role refresh is designed to reduce forced re-login after role changes.
- Static assets and API paths are handled carefully in middleware to prevent incorrect HTML responses for non-page requests.

## Validation Checklist

Use this checklist before final submission:

1. Sign in as viewer and verify assistant page is not accessible.
2. Sign in as analyst/admin and verify assistant page works.
3. Confirm assistant responses use live finance context.
4. Confirm `/api/auth/session` and assistant API return JSON under authenticated conditions.
5. Run lint/build checks and resolve any blocking errors.

## Future Enhancements

- Persist full assistant conversation history to MongoDB instead of local/session-only state.
- Add server-side structured telemetry for assistant prompts and latencies.
- Add role-scoped usage quotas and admin observability for assistant usage.
- Add automated integration tests for RBAC + assistant endpoint behavior.
