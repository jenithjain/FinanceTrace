# Assistant Integration Plan (Gemini 2.5 Flash)

## Objective

Integrate a production-ready finance assistant that answers analyst/admin questions using live dashboard data, with strict RBAC and safe operational controls.

This plan adapts the provided reference implementation to the current FinanceTrace codebase.

## Current State

What exists now:

- UI-only assistant page at app/assistant/page.js
- No backend API route at app/api/finance/assistant/route.js
- No assistant-specific hook under hooks/
- No Gemini client wrapper module in lib/gemini.js

What already exists and can be reused:

- JWT role middleware: lib/middleware/withAuth.js
- Dashboard data APIs used as context source:
  - /api/finance/dashboard/summary
  - /api/finance/dashboard/by-category
  - /api/finance/dashboard/trends
  - /api/finance/dashboard/recent
- Date-range support already implemented in dashboard APIs

## Reference-to-Project Mapping

Reference file -> Recommended workspace file

- lib/gemini.js -> lib/gemini.js (new)
- app/api/finance/assistant/route.js -> app/api/finance/assistant/route.js (new)
- hooks/useFinanceAssistant.js -> hooks/useFinanceAssistant.js (new)
- app/dashboard/assistant/page.jsx -> app/assistant/page.js (replace/refactor existing)

Alternative routing option:

- If assistant should be dashboard-scoped, create app/dashboard/assistant/page.js and adjust navigation links.

## Critical Adaptations Needed

1) Token key alignment

Reference uses localStorage key finance_token.
Current app uses financeToken in localStorage and NextAuth session financeToken.

Required approach:

- Client should read financeToken first
- Keep finance_token backward compatibility only if needed
- Always send Authorization: Bearer <token>

2) Internal API URL handling

Avoid hard dependency on NEXT_PUBLIC_APP_URL in backend route for server-side internal calls when request host is available.
Use request host/protocol fallback robustly.

3) Date-range context alignment

Assistant context should include active date range where available.
If assistant route supports optional startDate/endDate, pass to dashboard context fetches.

4) Rate limiting implementation

Reference uses in-memory map and setInterval cleanup.
For current phase, this is acceptable as a baseline.
For production, replace with Redis sliding window.

5) Session and role security

Assistant route must enforce analyst/admin via withAuth.
No client-side-only role checks.

## Implementation Phases

### Phase 1: Backend foundation

- Add lib/gemini.js
  - singleton GoogleGenerativeAI client
  - model constant
  - generation config
  - basic per-user in-memory rate limit utility
- Add app/api/finance/assistant/route.js
  - withAuth(handler, ["analyst", "admin"])
  - validate incoming message and history
  - enforce rate limit
  - fetch finance context from existing dashboard APIs
  - construct system prompt with strict data grounding
  - call Gemini model
  - return normalized success/error response

Deliverable:

- POST /api/finance/assistant available and protected

### Phase 2: Frontend state hook

- Add hooks/useFinanceAssistant.js
  - message state
  - loading/error handling
  - abort support for in-flight requests
  - sessionStorage persistence
  - sendMessage(content, token)

Deliverable:

- reusable assistant chat state manager

### Phase 3: Assistant UI refactor

- Replace app/assistant/page.js simulation with real API-driven UI
- Keep current design style, but wire messages to hook
- Add suggested prompts and clear chat
- Use real toasts for errors

Deliverable:

- functional assistant chat page with live responses

### Phase 4: Navigation and route coherence

- Ensure assistant is reachable from menu for analyst/admin
- Decide final route:
  - keep /assistant
  - or move to /dashboard/assistant
- update layouts and links consistently

Deliverable:

- clean UX entry points by role

### Phase 5: Safety and reliability hardening

- sanitize/limit history length
- cap prompt size and output size
- handle Gemini API specific failures with user-safe errors
- add telemetry-ready logs (without leaking secrets)

Deliverable:

- robust failure behavior

### Phase 6: Verification

- role validation checks:
  - viewer receives 403
  - analyst/admin allowed
- context grounding checks:
  - responses reflect live summary/categories/trends/recent
- rate limit checks
- regression checks on dashboard and transactions pages

Deliverable:

- integration acceptance complete

## API Contract Recommendation

Endpoint:

- POST /api/finance/assistant

Request:

- message: string
- conversationHistory: array (optional)
- startDate/endDate: optional strings (recommended extension)

Response success data:

- message
- role
- timestamp
- dataContext metadata

Error contract:

- keep existing apiResponse helpers for consistency

## Prompting Strategy

System prompt should enforce:

- finance-only responses
- strict grounding in supplied live data
- explicit uncertainty when data is missing
- concise and actionable output style

Model settings recommendation:

- model: gemini-2.5-flash-preview-05-20
- temperature: 0.2 to 0.3
- maxOutputTokens: 800 to 1200

## Risks and Mitigations

Risk: Hallucinated numbers

- Mitigation: strict system instruction and explicit data payload injection

Risk: noisy long prompts

- Mitigation: trim history, summarize long context, cap tokens

Risk: abuse/spam usage

- Mitigation: per-user rate limiting and message length limits

Risk: route latency spikes

- Mitigation: parallel fetch context calls and bounded timeout handling

## Acceptance Criteria

Minimum criteria:

- assistant responds with live data-backed outputs
- analyst/admin can use assistant, viewer cannot
- errors are handled gracefully and surfaced in UI
- no dashboard regressions
- docs updated and discoverable

## Recommended Next Step Sequence

1. Implement Phase 1 and Phase 2
2. Refactor existing app/assistant/page.js to consume hook
3. Validate role controls and response grounding
4. Add production notes for Redis-backed rate limiting
