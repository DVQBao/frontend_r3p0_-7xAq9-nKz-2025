# AI Project Context - TiemBanhNetflix_Web

Last major update: 2026-08-16

This file is the primary handoff document for any AI assistant or engineer working on
`TiemBanhNetflix_Web`. It is intentionally written as a technical operating manual,
not as marketing copy and not as a user guide.

The goal is simple: after reading this file, a future AI should understand the
architecture, critical business flows, safety invariants, known technical debt, and
the major changes made in the most recent working session without having to re-scan
the whole repository first.

Do not add real credentials, raw cookies, production tokens, API keys, or personally
identifying customer data to this file.

## Executive Summary

This project is a Netflix account-sharing system with several runtime surfaces:

- A public static frontend for users.
- A hidden admin panel.
- A hidden collaborator/CTV portal.
- A Chrome Extension used to inject Netflix cookies for browser-based guest watching.
- An Express + MongoDB backend that manages users, credits, cookies, TV activation,
  mobile app login tokens, collaborator quota, admin controls, abuse detection, and
  marketing/showcase data.
- Auxiliary scripts and Python tooling for token generation, cookie checking, and
  `canPlay` research/debugging.

The project is not a modern single-page application with a clean build pipeline.
Much of the frontend is static HTML plus large inline scripts and plain JavaScript
files. The backend is modular Express, but many core business rules live in models
and middleware rather than only in route handlers.

The most important runtime concepts are:

- `Cookie`: the PC/browser Netflix cookie source used by the Chrome Extension.
- `MobileCookie`: the TV/app-login cookie derived from a PC `Cookie` after the
  extension syncs both `NetflixId` and `SecureNetflixId`.
- `CtvCookie`: collaborator-facing cookie slots derived from PC/mobile cookie data.
- `User`: the main customer account, including plan, credits, quota, referral,
  verification, and assigned cookie state.
- `SystemConfig`: small runtime configuration store. It now includes
  `auth_showcase_config` for the auth-page movie showcase and
  `server_canplay_enabled` for the live Render canplay switch.
- `CanplayCheckRun`: persistent audit of GitHub Actions based PC-cookie `canPlay`
  checks. Current runs use the CLCS-aware rule version.

## Coupon And Promotion Campaign Contract (2026-08-16)

Coupon payment remains a manual-verification flow. Applying a code only records the
discounted amount and the intended product; it never upgrades Pro, adds credits, or
marks the code used. If a valid coupon exists but is not applied, checkout shows a
generic warning without revealing the code. Continuing at full price records a
pending `forfeited` decision, but the coupon remains usable until an admin explicitly
decides otherwise. On both desktop and mobile admin, saving an edited account or
confirming a Pro upgrade checks the already-loaded active-voucher summary. If a voucher
exists, the admin chooses either to keep it while still saving the account change, or
to deactivate it. Deactivation records an applied checkout as `redeemed` and a code
that was never applied as `forfeited`; both outcomes make the admin list return
`No voucher`. The anti-reuse ledger is saved in the same `User` write before the
separate coupon reporting document is finalized. New admin clients send the explicit
boolean `deactivateActiveVoucher`; backend routes preserve the former fulfillment
behavior only for older clients that omit this field entirely.

The main data sources are:

- `PromotionCampaign`: audience snapshot, coupon/email rules, lifecycle, and totals.
- `CampaignRecipient`: persistent bounded email queue with leases and retry state.
- `Coupon`: globally unique code bound to one campaign, user, and email snapshot.
- `User`: post-deployment counters and timestamps plus an internal redeemed-code
  ledger and marketing opt-out flag.

Existing users are not mass-migrated or backfilled. Missing promotion/purchase
counters are treated as zero in MongoDB audience filters; defaults are written only
when a user is subsequently saved through normal application activity. Campaigns
can filter by Free/Pro, Pro expiry, recent activity, credit balance, coupon issuance
count, and post-deployment Pro/credit purchase counts. Audience preview returns only
a count and never renders the complete matching user list.

Desktop admin campaigns support two audience modes: `filters` and `emails`. The
`emails` mode accepts newline/comma/semicolon-separated addresses, lowercases and
deduplicates them on both client and server, rejects malformed addresses, and matches
exact existing user emails. It intentionally ignores plan/history filters but still
honors the verified/active checkbox, active-coupon exclusion checkbox, and the absolute
marketing opt-out rule. Campaigns store `audienceMode` plus `targetEmailCount`; the
actual selected accounts remain represented by `CampaignRecipient` documents rather
than duplicating the raw address list in the campaign document.

Public coupon endpoints are under `/api/promotions`. Admin campaign endpoints are
under `/api/admin/promotions`. `POST /api/credits/purchase` is validation-only and
must not grant credits; fulfillment authority remains the existing admin routes.
The public credit-purchase and Pro-payment views both support coupon entry. Pro first
shows a coupon prompt and the subsequent QR/payment modal retains a second entry
point in case the prompt was skipped. The QR amount is the server-calculated final
amount while the granted credit quantity is still based on the original order.
The Pro coupon status check completes before its prompt is revealed so transient
loading copy cannot resize the open modal and cause a visible layout jump.
That status response includes only the calculated discount amount (never the coupon
code), allowing the prompt to explain the available saving before the user checks email.
On mobile, that saving phrase is highlighted in yellow and the prompt actions use a
30/70 cancel-to-continue width ratio. The same saving phrase is highlighted in the
mobile forfeit warning, whose caution begins `Lưu ý: Tiếp tục thanh toán...`; desktop
prompt styling remains unchanged.

Campaign coupon codes are per-user and unique. Code checks enforce user/email
binding, active campaign, validity window, product scope, minimum order, single use,
and a minimum payable amount. Campaign reporting distinguishes coupons that actually
reduced a payment from coupons forfeited after the customer explicitly continued at
full price. Cancelling a campaign revokes unused codes and skips
queued recipients. Admin can also forcibly recall and permanently delete any campaign;
recall removes its coupons and recipient history, then rebuilds affected users' coupon
counters from the remaining coupons. It never reverses Pro or Credits already granted.
Rejected coupon states intentionally share the customer-facing message
`Mã ưu đãi không hợp lệ, vui lòng kiểm tra lại!`; detailed rejection reasons are not
shown in the purchase UI. New coupon campaigns default to the `both` scope.
Coupon campaign `datetime-local` inputs are Vietnam wall-clock values. The desktop
admin converts them to timezone-qualified ISO timestamps before sending, and the
backend also interprets legacy timezone-less campaign timestamps as UTC+07:00. This
keeps `validFrom` and `expiresAt` identical across local development and UTC Render
instances; do not replace this parsing with environment-dependent `new Date(rawValue)`.
Promotional email content is HTML-escaped, uses an SF Pro-first font stack and a
responsive Netflix red/white/black light theme, and contains no unsubscribe link or
copy-code button. Coupon mail includes a discount-aware usage guide. Campaign content
may include admin-authored emoji. The worker defaults
to 10 messages per batch and 250 successful messages per Bangkok day; deployments may
tune `PROMOTION_EMAIL_INTERVAL_MS`, `PROMOTION_EMAIL_BATCH_SIZE`,
`PROMOTION_EMAIL_DAILY_LIMIT`, `PUBLIC_WEB_URL`, and `BREVO_REPLY_TO_EMAIL`.

The campaign-management UI is intentionally desktop-only in
`NetflixFrontend/x7Kv9mPq3nRt2025/index.html`. Do not add it to or change the mobile
admin workflow. Relevant automated checks live in `NetflixBackend/tests/promotion*`
and `NetflixFrontend/tests/promotions-ui.test.js`.
Its issued-coupon table is a separate subview opened from the campaign header, not a
section appended below campaign history. It uses `GET /api/admin/promotions/coupons`
and server-side pagination capped at 50 users. Search is limited to coupon code/email;
each user occupies one row with aggregate receipt/status counters and their current
unfinalized coupon, if any.

The main Admin user API exposes `activeCoupon` for concise voucher badges on both PC
and mobile, while `pendingCoupon` remains separate for fulfillment logic. The PC user
table keeps voucher value in its own column; never append coupon details to email text.

## Canonical canPlay Contract (2026-08-08)

This section supersedes every older `/browse`, PACS `CAN_PLAYBACK`, movie-ID, or
"return the link on an inconclusive check" note that may remain in historical
parts of this document.

`CAN PLAY` is now proven by the Netflix account flow: first
`GET https://www.netflix.com/account`, then the client-rendered payment state from
`POST https://web.prod.cloud.netflix.com/graphql` using the same Netflix session:

1. The membership plan must be extracted and recognized as Premium, Standard,
   Basic, or Mobile.
2. The plan must not be an ad-supported variant. Requests prefer Vietnamese and
   the parser recognizes ad labels across the supported localized markers.
3. The persisted GraphQL operation `CLCSInterstitialAccountPages` must complete.
   A clean response with `data.clcsInterstitialAccountPages=null` and no GraphQL errors
   produces `payment=OK`. A returned component
   tree containing `testId=UPDATE_PAYMENT_METHOD` or the workflow
   `payment_failure_interstitial` produces `payment=FAIL`. CSS hashes and localized
   warning text are not payment authorities.

Classification and fallback rules:

- Missing/unrecognized plan, unknown payment status, ad-supported plan, payment failure,
  and login/signup
  redirects are never canPlay.
- Missing/unrecognized plan is eligibility-inconclusive: do not return a cookie/link
  and do not deactivate it. Technical failures such as timeout, hard timeout,
  connection error, HTTP 403/429/5xx, empty response, or `Error:*` use the legacy
  availability fallback: return the candidate cookie/already-generated token link
  without deactivating it, even though the canplay check itself remains `UNKNOWN`.
- Confirmed `NO_PLAY` can deactivate the affected PC, Mobile, or CTV cookie using
  the existing synchronization rules.
- Batch admin sync marks confirmed `NO_PLAY` dead. `UNKNOWN` is kept for recheck by
  default (`markUnknownAsDie=false`). Sync only resets Cookie IDs present in that
  run, so it cannot reactivate cookies excluded from or added after the scan.
- New batch runs store `settings.ruleVersion=account-plan-payment-clcs-v2`; admin sync
  rejects older/unversioned PACS runs and requires a fresh scan after deployment.
- Live Render checks have an independent admin switch stored under the SystemConfig
  key `server_canplay_enabled` (default `true`). When disabled, PC guest/login,
  TV App Login, CTV portal/API, and regeneration skip the outbound Netflix request and
  use the technical fallback, so links/cookies are still returned without deactivation.
  Failure to read this control also fails safely to the same fallback instead of
  blocking the user or sending an uncontrolled Netflix request. The GitHub Actions
  batch checker remains enabled and independent of this switch.
- Movie ID is no longer part of canPlay. `CookieChecker_v5.py` keeps compatible
  function parameters internally but removes the Movie ID requirement from its UI.
  It does not cache `UNKNOWN`; confirmed results use a 60-second cache.

The shared backend authority is `NetflixBackend/utils/canPlayChecker.js`. Live routes
pass through `NetflixBackend/utils/serverCanPlayControl.js`, while the GitHub batch
checker calls the authority directly and therefore ignores the Render switch.
`TokenGenerator/CookieChecker_v5.py` mirrors the same rule.

## Current High-Level Architecture

```text
NetflixFrontend/
  public static pages, hidden admin panel, hidden CTV portal, Chrome Extension

NetflixBackend/
  Express API, MongoDB models, middleware, route families, canPlay utilities

TokenGenerator/
  Python research/debug tooling for nftoken, cookies, canPlay behavior

.github/workflows/check-pc-canplay.yml
  GitHub Actions workflow for batch-checking PC cookie playability
```

There is no central frontend state-management library. There is no frontend build
step that compiles components. Most edits are direct HTML/CSS/JS edits.

The backend uses:

- Node.js / Express 5
- Mongoose / MongoDB
- JWT authentication
- Brevo email service
- GitHub Actions integration for PC `canPlay` audits
- Watchmode and TMDB for auth-page movie/showcase data
- Render-style production deployment assumptions

## Recommended Reading Order

When starting a new session, read this file first. Then, depending on the task:

1. Main public page and PC watch flow:
   - `NetflixFrontend/index.html`
   - `NetflixFrontend/app.js`
   - `NetflixFrontend/cookie-retry-handler.js`
   - `NetflixBackend/routes/cookies.js`
   - `NetflixBackend/middleware/abuseDetector.js`

2. Auth/login/register page:
   - `NetflixFrontend/auth/index.html`
   - `NetflixFrontend/auth.js`
   - `NetflixBackend/routes/auth.js`

3. Admin panel:
   - `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
   - `NetflixBackend/routes/admin*.js`

4. CTV/collaborator portal:
   - `NetflixFrontend/mK7xCtv9pR2026/index.html`
   - `NetflixBackend/routes/ctv*.js`

5. TV activation and app login:
   - `NetflixBackend/routes/tv.js`
   - `NetflixBackend/models/MobileCookie.js`
   - `NetflixBackend/utils/tokenGenerator.js`
   - `NetflixBackend/utils/canPlayChecker.js`

6. Auth-page movie showcase:
   - `NetflixFrontend/auth/index.html`
   - `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
   - `NetflixBackend/routes/auth-showcase.js`
   - `NetflixBackend/routes/admin-showcase.js`

7. Batch PC `canPlay` audit:
   - `NetflixBackend/routes/admin-canplay.js`
   - `NetflixBackend/utils/canPlayChecker.js`
   - `NetflixBackend/utils/serverCanPlayControl.js`
   - `NetflixBackend/scripts/check-pc-canplay.js`
   - `.github/workflows/check-pc-canplay.yml`
   - `NetflixBackend/.github/workflows/check-pc-canplay.yml`
   - `NetflixBackend/models/CanplayCheckRun.js`

## Repository Map

### Frontend

| Path | Role | Notes |
| --- | --- | --- |
| `NetflixFrontend/index.html` | Main public landing/dashboard page | Very large HTML file with important inline scripts. Includes logged-in dashboard, PC guest watch UI, TV/app-login UI, credits/referral/payment surfaces. |
| `NetflixFrontend/app.js` | Main public-page orchestration | Handles extension detection, browser guest-watch flows, tab focus, legacy/demo helpers, and UI integration. |
| `NetflixFrontend/auth.js` | Auth UI/business helpers | Login/register/OTP/forgot password/referral/credits logic. Also contains older local/demo traces. |
| `NetflixFrontend/cookie-retry-handler.js` | PC guest-watch retry state machine | Core frontend for `/api/cookies/preview`, extension injection, `/confirm`, `/report-failed`, secure cookie sync. |
| `NetflixFrontend/config.js` | Runtime backend URL selection | Uses localhost -> `http://localhost:3000`, otherwise production API. |
| `NetflixFrontend/auth/index.html` | Dedicated login/register page | Contains the auth-page Netflix/movie showcase. Has duplicate legacy showcase helper blocks; the later `renderShowcase` block is authoritative. |
| `NetflixFrontend/x7Kv9mPq3nRt2025/index.html` | Hidden admin panel | Single-file app. PC UI is primary. Mobile admin UI exists but Auth Showcase button was removed from mobile. |
| `NetflixFrontend/mK7xCtv9pR2026/index.html` | Hidden collaborator/CTV portal | Single-file collaborator UI for quota, token links, history, API key management. |
| `NetflixFrontend/TiemBanhNetflixExtension/` | Chrome Extension MV3 | Required for PC guest-watch cookie injection and secure-cookie readback. |
| `NetflixFrontend/shop/` | Affiliate/shop surface | Static product data and product manager helpers. |
| `NetflixFrontend/install-guide/` | Extension install guide | Public support surface. |
| `NetflixFrontend/contact/`, `privacy-policy/`, `terms-of-service/`, `study/`, `maintenance/` | Other public static pages | Not core business logic but still production surfaces. |

### Backend

| Path | Role | Notes |
| --- | --- | --- |
| `NetflixBackend/server.js` | Express bootstrap | Loads env, CORS, compression, security headers, route mounting, MongoDB connection. |
| `NetflixBackend/routes/auth.js` | User auth/OTP/forgot/reset | Handles registration, login, OTP email verification, temp tokens, forgot password. |
| `NetflixBackend/routes/cookies.js` | PC cookie business flow | Most complex route. Handles guest/preview/confirm/report/sync-secure/release and server-side `canPlay` gating. |
| `NetflixBackend/routes/tv.js` | TV activation and mobile app login | Uses `MobileCookie`, `SecureNetflixId`, `nftoken`, and `canPlay`. |
| `NetflixBackend/routes/admin*.js` | Admin APIs | User, cookie, CTV, rate-limit, canplay, showcase management. |
| `NetflixBackend/routes/ctv*.js` | Collaborator portal and API | CTV auth, portal actions, public API-key flow. |
| `NetflixBackend/routes/auth-showcase.js` | Public auth-page movie showcase data | Uses Watchmode/TMDB plus managed config. Has fast managed-config path and timeout fallback. |
| `NetflixBackend/routes/admin-showcase.js` | Admin-managed auth showcase config | Stores config in `SystemConfig.auth_showcase_config`, local inventory, validates TMDB/Watchmode IDs on demand. |
| `NetflixBackend/routes/admin-canplay.js` | Admin canplay control | Starts GitHub workflow, reads/syncs run results, and exposes the live Render switch. |
| `NetflixBackend/models/*.js` | Mongoose models | Business invariants are often here. |
| `NetflixBackend/middleware/*.js` | Auth, quota, abuse, nonce, rate limit | Important safety behavior is here. |
| `NetflixBackend/utils/*.js` | Email, request info, token generation, canPlay | `canPlayChecker.js` is the shared eligibility authority; `serverCanPlayControl.js` gates only live backend calls. |
| `NetflixBackend/scripts/check-pc-canplay.js` | Batch PC cookie playability checker | Runs in GitHub Actions and writes `CanplayCheckRun`. |

## Backend Route Surface

`server.js` currently mounts these route groups:

```text
/api/auth                 -> routes/auth.js
/api/users                -> routes/users.js
/api/cookies              -> routes/cookies.js
/api/credits              -> routes/credits.js
/api/referral             -> routes/referral.js
/api/message              -> routes/message.js
/api/auth-showcase        -> routes/auth-showcase.js
/api/tv                   -> routes/tv.js
/api/admin                -> routes/admin.js
/api/admin-auth           -> routes/admin-auth.js
/api/admin/cookies        -> routes/admin-cookies.js
/api/admin/rate-limit     -> routes/admin-rate-limit.js
/api/admin-users          -> routes/admin-users.js
/api/ctv-auth             -> routes/ctv-auth.js
/api/ctv                  -> routes/ctv.js
/api/ctv-api              -> routes/ctv-api.js
/api/admin/ctv            -> routes/admin-ctv.js
/api/admin/canplay        -> routes/admin-canplay.js
/api/admin/showcase       -> routes/admin-showcase.js
```

`/api/health` is the health check. The root route returns a small JSON service
status. The older root-route endpoint listing after the first `return` is dead code.

## Data Model Overview

### User

File: `NetflixBackend/models/User.js`

Key responsibilities:

- Identity: name, email, password/provider.
- Plan: `free` or `pro`.
- Credits and credit history.
- Monthly report/cookie-switch quota.
- Email verification and pending/active/locked/suspended status.
- Device fingerprint and login metadata.
- Referral tracking and monthly referral limits.
- Assigned PC cookie and assigned mobile cookie state.

Important methods:

- `comparePassword`
- `isProActive`
- `verifyEmail`
- `canUseService`
- `deductCredits(amount, type, description)`
- `deductCredit(type, description)`
- `addCredits(amount, type, description, options)`
- `resetCreditsIfNeeded`
- referral methods such as `checkAndResetMonthlyReferrals`, `canRefer`

Critical invariants:

- Free users get 3 finite credits that expire after 1 day. Expired free credits go
  to 0; they do not automatically refill.
- Pro expiration is checked before free-credit expiration. Expired Pro users are
  downgraded to Free and receive a fresh 3-credit free period.
- `monthlyReportLimit` is plan-dependent: Free has lower limit, Pro has higher limit.
- Free users may use PC/browser watch flows only. TV activation and Netflix Mobile
  App login are Pro-only backend entitlements. TV account switching via
  `/api/cookies/switch-mobile` is also Pro-only and must not deduct Free monthly
  switch quota. Frontend TV buttons should remain clickable for logged-in Free users
  and open the Pro-only upgrade modal instead of being hard-disabled.
- Referral rewards are 2 credits per successful referral. Pro is priced at
  40.000 VNĐ/month and includes 40 credits per 30-day period. Credit purchase
  minimum is 40.000 VNĐ, which equals 40 credits at 1.000 VNĐ per credit.
- Current service costs are: PC guest watch 1 credit, PC login link 1 credit,
  TV activation 2 credits, and Mobile App login 2 credits.

### Cookie

File: `NetflixBackend/models/Cookie.js`

This is the PC/browser Netflix cookie source.

Key fields:

- `value`: NetflixId value or cookie string.
- `secureNetflixId`: populated later by extension sync.
- `currentUsers`: user IDs currently assigned.
- `maxUsers`: slot limit.
- `isActive`, `expiresAt`, `usageCount`, `cookieNumber`.
- `canplayStatus`, `canplayDetail`, `canplayCheckedAt`, `canplayRunId`.
- `notes`.

Important methods:

- `isExpired`
- `isAvailable`
- `assignToUser`
- `releaseFromUser`

Important behavior:

- A `Cookie` may be active but full if `currentUsers.length >= maxUsers`.
- A successful PC guest watch only becomes a real assignment after `/api/cookies/confirm`.
- `canplayStatus` metadata is updated by admin/batch `canPlay` sync, but it is not the
  only source of truth during live preview. Live preview can run its own `canPlay`.

### MobileCookie

File: `NetflixBackend/models/MobileCookie.js`

This is the TV/app-login cookie form derived from a PC `Cookie`.

Key fields:

- `netflixId`
- `secureNetflixId`
- `sourceCookieId`
- `cookieNumber`
- `maxSlots`, `currentSlots`
- `assignedUser`
- `wrongCodeCount`
- `isActive`, `notes`

Important invariant:

- `sourceCookieId` is unique: one PC `Cookie` maps to at most one `MobileCookie`.
- A `MobileCookie` requires both `NetflixId` and `SecureNetflixId`.
- `wrongCodeCount` is not simply "user typed wrong code". It is incremented only when
  this cookie returns `WRONG_CODE` but another cookie succeeds for the same TV code,
  proving the TV code was valid and this cookie is bad.

### CtvCookie

File: `NetflixBackend/models/CtvCookie.js`

Collaborator-facing cookie slots. Derived from source cookie data and consumed by
the CTV portal/API.

Important invariant:

- `sourceCookieId` is unique.
- CTV cookies can be synced inactive when their mobile/source cookie is marked bad.

### Collaborator and CtvCookieLog

Files:

- `NetflixBackend/models/Collaborator.js`
- `NetflixBackend/models/CtvCookieLog.js`

`Collaborator` controls portal login, status, dates, quota, used count, API key, and
safe serialization.

`CtvCookieLog` is the audit/history table for consumed CTV cookies and token links.
It is used by both the CTV portal and public API-key flow.

### PendingVerification

File: `NetflixBackend/models/PendingVerification.js`

Stores OTP verification state with TTL. It tracks email, OTP, attempts, resend
timing, and device fingerprint.

### SystemConfig

File: `NetflixBackend/models/SystemConfig.js`

General key-value runtime config store.

Important keys:

- `smsOtpLeft`: despite the name, this is currently used as email OTP quota.
- `auth_showcase_config`: admin-managed auth-page movie showcase config.
- `server_canplay_enabled`: Boolean, defaults to enabled when absent. Admin can change
  it at runtime; the value persists across Render restarts/redeploys.

### BannedUser

File: `NetflixBackend/models/BannedUser.js`

Stores persistent bans by identifier. Used together with in-memory rate-limit and
abuse trackers.

### CanplayCheckRun

File: `NetflixBackend/models/CanplayCheckRun.js`

Stores results from GitHub Actions based PC cookie `canPlay` scans.

Important fields:

- `runId`, `githubRunId`, workflow/repository/ref metadata.
- `status`: `running`, `completed`, `failed`.
- `settings`: workers, delay, timeout, activeOnly, limit, run label, and
  `ruleVersion=account-plan-payment-clcs-v2` for current runs.
- `summary`: aggregate counts.
- `results`: per-cookie `CAN_PLAY`, `NO_PLAY`, or `UNKNOWN`.
- `sync`: audit of syncing the run back into `Cookie` records.

The JSON artifact produced by the current runner uses `schemaVersion: 2`. Admin sync
also verifies the rule version so an older PACS/movie-based result cannot silently
change current inventory.

## Core Business Flows

## 1. Registration, Email OTP, and Login

Main files:

- `NetflixFrontend/auth.js`
- `NetflixFrontend/auth/index.html`
- `NetflixBackend/routes/auth.js`
- `NetflixBackend/models/PendingVerification.js`
- `NetflixBackend/models/SystemConfig.js`

Registration flow:

```text
User submits registration
  -> POST /api/auth/register
     -> normalize Gmail aliases
     -> check existing user and device fingerprint
     -> check SystemConfig.smsOtpLeft
        -> if OTP quota available:
             create/update PendingVerification
             send OTP email through Brevo
             frontend enters OTP verification flow
        -> if OTP quota exhausted:
             frontend/backend use register-without-otp path
             user may be created pending/unverified
```

Login flow:

```text
User login
  -> POST /api/auth/login
     -> if emailVerified=true: normal token
     -> if emailVerified=false and OTP quota available:
          login is blocked and temp token is returned for verification
     -> if emailVerified=false and OTP quota exhausted:
          login can be allowed, but service routes may still block via checkEmailVerified
```

Important rule:

- "User can log in" does not necessarily mean "user can use paid/service routes".
  Routes protected by `checkEmailVerified` can still reject pending/unverified users.

## 2. PC Watch as Guest Flow

Main files:

- `NetflixFrontend/index.html`
- `NetflixFrontend/app.js`
- `NetflixFrontend/cookie-retry-handler.js`
- `NetflixFrontend/TiemBanhNetflixExtension/background.js`
- `NetflixFrontend/TiemBanhNetflixExtension/content.js`
- `NetflixBackend/routes/cookies.js`
- `NetflixBackend/middleware/abuseDetector.js`
- `NetflixBackend/middleware/nonceManager.js`
- `NetflixBackend/utils/canPlayChecker.js`

Current recommended flow:

```text
User clicks Watch as guest
  -> frontend creates CookieRetryHandler
  -> CookieRetryHandler obtains one-time nonce
  -> GET /api/cookies/preview
       - requires JWT
       - requires email verified
       - requires quota/credits
       - requires Origin check
       - requires one-time nonce
       - requires extension info header
       - runs abuse/preview checks
       - may run server-side canPlay before returning a cookie
       - DOES NOT assign cookie yet
  -> frontend sends cookie to Chrome Extension
  -> extension clears Netflix cookies, injects cookie, opens/focuses Netflix
  -> content/background checks /browse or Netflix error state
  -> if success:
       POST /api/cookies/confirm
       assign cookie, release old cookie if switching, deduct credit if needed
       possibly start SecureNetflixId polling/sync
  -> if cookie failure:
       POST /api/cookies/:id/report-failed
       set proof for skipCurrent/excludeIds retry
       retry preview with controlled skip/exclude
  -> if extension/network failure:
       POST /api/cookies/release
       stop retry, do not mark cookie dead
```

Important distinction:

- `/api/cookies/guest` still exists, but the modern retry flow should use
  `/api/cookies/preview` + `/api/cookies/confirm`.
- `/preview` is deliberately "preview only"; it must not increment slots.
- `/confirm` is the point where cookie assignment and credit deduction happen.

## 3. Server-Side canPlay in Guest Preview

The original implementation was revised on 2026-07-18 to use the canonical
account-eligibility contract above.

Current constants in `routes/cookies.js`:

```text
GUEST_CANPLAY_MAX_ATTEMPTS = 5
GUEST_CANPLAY_TIMEOUT_MS = 12_000
GUEST_CANPLAY_ATTEMPTS = 1
```

Current behavior:

```text
findPlayableGuestCookie(...)
  -> include current cookie unless skipCurrent=true
  -> collect candidates up to max attempts
  -> for each candidate:
       run checkServerCanPlay(cleanNetflixId) with 12s timeout
       (`/account` HTML for plan + CLCS GraphQL for payment)
       also wrap with hard timeout at 13s
       if playable:
          return this candidate
       if detail is a technical availability failure or live checking is disabled:
          return this candidate via fallback without deactivation
       if plan/parser eligibility is inconclusive:
          skip candidate without deactivating it
        if confirmed NO_PLAY (login, ads, or payment failure):
          deactivate PC cookie
          sync corresponding MobileCookie inactive
          sync CtvCookie inactive from mobile if needed
          try next candidate
  -> if none found:
       return 503
```

Technical details that qualify for link/cookie fallback currently include:

- `Timeout`
- `Hard timeout`
- `Connection error`
- `Empty account response`
- `Empty CLCS response`
- `Account blocked HTTP 403`
- HTTP `429` and `5xx`
- details starting with `Error:`
- `Server canPlay disabled`
- `Server canPlay control unavailable`

Eligibility-inconclusive details such as `Plan not found`, `Plan type not recognized`,
and `Payment status unknown` are also non-deactivating, but they do not qualify for
availability fallback and therefore withhold/skip the candidate. A technical CLCS
failure such as timeout, connection failure, HTTP 403/429/5xx, empty response, or an
invalid response remains a technical fallback instead of being guessed as payment OK.

Why this matters:

- The observed bug was intermittent: "Generate link" worked, but "Watch as guest"
  sometimes showed logging in and then failed or got stuck.
- The root issue was that the guest preview path could block before returning a
  cookie to the extension because server-side `canPlay` had not completed.
- Bounded technical failures do not hang the request and fall back to extension/
  Netflix verification. Plan/parser uncertainty is withheld rather than guessed.

Operational interpretation of logs:

- Default flow logs are compact summaries prefixed by a stable icon and flow name,
  such as `👀 [Guest Preview]`, `💻 [PC Login]`, `📺 [CTV]`, `🔌 [CTV API]`, and
  `🎟️ [TokenGen]`.
- Set `FLOW_LOG_VERBOSE=true` only during diagnosis to show cookie-pool, per-attempt,
  canPlay timing, assignment, and retry details. In verbose output, `timeoutMs=12000`
  means each server-side guest-preview canPlay attempt has a 12-second internal timeout.
- The hard wrapper returns `Hard timeout` after roughly 13 seconds so the request
  does not hang indefinitely.
- If the detail is a technical fallback failure, the candidate remains active and is
  returned for extension verification. Missing/unrecognized plan remains withheld.
- `serverCanPlayControl.js` reads `server_canplay_enabled` with a five-second cache,
  deduplicates simultaneous config reads, and prevents an older in-flight read from
  overwriting a newer admin update. A config-read failure fails safely to fallback.

## 4. skipCurrent, excludeIds, and Proof Semantics

Files:

- `NetflixFrontend/cookie-retry-handler.js`
- `NetflixBackend/routes/cookies.js`
- `NetflixBackend/middleware/abuseDetector.js`

This area is security-sensitive.

Intent:

- `skipCurrent=true` means "do not return the current cookie; try another one."
- `excludeIds` means "do not return cookies already attempted in this retry session."
- Both can be abused to enumerate or drain cookie inventory, so both require proof.

Valid proof:

- Recent `/api/cookies/:id/report-failed`
- Recent `/api/cookies/report-issue`
- DB fallback via `User.lastReportTime` if in-memory tracker was lost after server
  restart

Current backend behavior:

- `skipCurrent=true` without proof and without `excludeIds` is downgraded to a normal
  preview. This reduces false failures for real users.
- `skipCurrent=true` with `excludeIds` but without proof is denied.
- `excludeIds` without proof is treated as abuse and can lead to ban behavior.

Current frontend behavior:

- `CookieRetryHandler` only sends `skipCurrent=true` when `hasRetryProof` is true.
- `hasRetryProof` is set only after backend accepts `/report-failed`.
- If `/report-failed` does not complete, retry stops with
  `REPORT_FAILED_NOT_CONFIRMED` instead of sending an unsafe skip request.

Why this matters:

- In logs, `[SECURITY] skipCurrent=true DENIED` can still happen if a request is
  manually crafted, stale, has exclude IDs without proof, or the report/issue proof
  did not exist.
- The expected normal user flow should hit this less often after the frontend/backend
  changes, but it is still intentionally possible for suspicious requests.

## 5. Cookie Confirmation and Credit Deduction

File: `NetflixBackend/routes/cookies.js`

`POST /api/cookies/confirm`:

- verifies extension info
- resets abuse tracker via `recordConfirm`
- releases old cookie if switching
- marks old cookie inactive with `Die - Recheck` only when notes are safe to overwrite
- syncs corresponding `MobileCookie` inactive if old PC cookie is killed
- assigns new cookie via `Cookie.assignToUser`
- sets `User.assignedCookie`
- deducts 1 credit for a new watch session
- skips credit deduction if user reported an issue within the last 60 seconds

Important:

- The old code comments mention several costs historically. The current confirm
  code deducts 1 credit for PC watch session through `deductCredit`.
- `PC_LOGIN_COST` controls `/api/cookies/pc-login-link`; guest-watch `/confirm` uses
  `deductCredit` directly. Both currently cost 1 credit, but remain separate flows.

## 6. Secure Cookie Sync

Files:

- `NetflixFrontend/cookie-retry-handler.js`
- `NetflixFrontend/TiemBanhNetflixExtension/background.js`
- `NetflixBackend/routes/cookies.js`

After successful PC login through Watch as Guest:

```text
/confirm returns hasSecureNetflixId=false
  -> CookieRetryHandler starts polling extension
  -> extension reads Netflix cookies from browser:
       NetflixId
       SecureNetflixId
  -> POST /api/cookies/sync-secure
       update source Cookie
       create/update MobileCookie
```

This is how PC cookie inventory becomes usable for TV/app-login.

Important:

- If `SecureNetflixId` is missing, TV/app-login cannot use that source cookie.
- Do not assume a PC cookie is mobile-ready just because PC login worked.

## Session Changes From 2026-07-30

- Free users receive 3 initial credits, and those credits expire after 1 day.
  `FREE_CREDITS_VALID_DAYS` in `models/User.js` is authoritative;
  public and admin expiration calculations must stay aligned with it.
- The Free watch modal and the shared pre-switch/report-issue advertising modal now
  use a 5-second countdown. The App/TV promo modal also remains at 5 seconds.
- Advertising modals now promote the same Google AI Pro/Gemini, ChatGPT Plus, and
  CapCut Pro catalog used by the `Nâng cấp tài khoản số` surface. Product cards open
  the corresponding detail in that shared modal instead of showing the former
  affiliate phone-accessory products.
- Digital-product cards use source SVG assets for Gemini and OpenAI from SVGL, plus
  the CapCut vector logo from Brandfetch (cropped to its icon viewBox), across advertising
  and product-detail surfaces. The digital-upgrade overlays
  use z-index values above the shared advertising modal so product details always open
  visibly on top and return to the advertisement when closed.
- Advertising product cards keep warranty messaging in one highlighted trust line instead
  of repeating it in every product summary. Gemini prices display `/12 tháng`, while
  ChatGPT Plus and CapCut prices display `/tháng`.
- Backend flow logging now uses compact icon-prefixed summaries for TokenGen, PC Login,
  App Login, Guest/Guest Preview, CTV portal/API/auth, and Admin CTV. Repeated attempt/canPlay/pool
  details are hidden unless `FLOW_LOG_VERBOSE=true`; cookie/credential previews and OTP
  values must never be written to logs.
- The post-login message modal is temporarily disabled by
  `POST_LOGIN_MESSAGE_MODAL = 'OFF'` in `NetflixBackend/routes/message.js`. Keep the
  celebration content and `BIG_UPDATE_MODAL` intact; switch the master flag back to `ON`
  when the modal is needed again.
- Do not log `Free credits expiring soon` from `User.resetCreditsIfNeeded()`. With a
  one-day Free validity period that warning applies throughout almost the entire cycle
  and is invoked repeatedly by quota middleware. Keep only the one-time log when credits
  actually expire and are changed to zero.

## 7. TV Activation

Main files:

- `NetflixFrontend/index.html`
- `NetflixBackend/routes/tv.js`
- `NetflixBackend/models/MobileCookie.js`
- `NetflixBackend/utils/tokenGenerator.js`
- `NetflixBackend/utils/canPlayChecker.js`

Simplified flow:

```text
User enters TV code
  -> POST /api/tv/activate
     -> JWT + email verification
     -> validate code format
     -> choose assigned MobileCookie or available MobileCookie
     -> try multiple cookies
     -> activate Netflix TV using NetflixId + SecureNetflixId
     -> if success:
          assign/reassign MobileCookie
          deduct TV/app login credits unless bypass applies
     -> if WRONG_CODE across all candidates:
          likely user typed wrong TV code
     -> if one cookie WRONG_CODE but another succeeds:
          mark the failed cookie's wrongCodeCount
          auto-deactivate when threshold is reached
```

Important bypass:

- After `/api/cookies/switch-mobile`, there is a 30-minute bypass window for mobile
  switching so users are not charged again immediately for TV/app-login.

## 8. Mobile App Login / nftoken

Main files:

- `NetflixBackend/routes/tv.js`
- `NetflixBackend/utils/tokenGenerator.js`
- `NetflixBackend/utils/canPlayChecker.js`
- `NetflixBackend/utils/serverCanPlayControl.js`
- `TokenGenerator/`

Flow:

```text
User requests app-login link
  -> POST /api/tv/generate-app-login
     -> select assigned or available MobileCookie
     -> generate nftoken from NetflixId/SecureNetflixId logic
     -> run bounded canPlay as quality gate
     -> if confirmed no-play (login, ads, or payment failure):
          deactivate cookie
     -> if canPlay failed technically (timeout/connection/block):
          return the generated token link as fallback; keep cookie active
     -> if plan is missing/unrecognized:
          withhold link and keep cookie active for retry
     -> if success:
          assign cookie if needed
          deduct credits unless bypass applies
          return token link
```

`TokenGenerator/` is the research/prototype/tooling area for this behavior. Backend
code is the productized implementation.

Important App Login canPlay rule:

- `/api/tv/generate-app-login` may already have a valid nftoken before `canPlay`
  finishes. Do not let this route wait on the default multi-attempt `checkCanPlay`
  path, because the frontend will stay stuck at "Đang tạo link...".
- `NetflixBackend/routes/tv.js` uses `APP_LOGIN_CANPLAY_TIMEOUT_MS = 12000`,
  `APP_LOGIN_CANPLAY_ATTEMPTS = 1`, and a hard timeout wrapper for App Login.
- Timeout/connection/block results return the generated link as a temporary-failure
  fallback and keep the `MobileCookie` active. Missing/unrecognized plan withholds
  the link. Confirmed no-play deactivates the cookie and syncs inactive state to CTV.

Important PC Login Link canPlay rule:

- `/api/cookies/pc-login-link` follows the same bounded strict semantics after
  successfully generating an nftoken: one `canPlay` attempt with a 12-second
  timeout and a hard timeout after roughly 13 seconds.
- Timeout/connection/block results return the generated PC login link and leave the
  cookie active. Missing/unrecognized plan withholds it. Confirmed no-play results
  deactivate the PC `Cookie`, sync inactive state to Mobile/CTV, and continue.

## 9. Admin Canplay System

Files:

- `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
- `NetflixBackend/routes/admin-canplay.js`
- `NetflixBackend/models/CanplayCheckRun.js`
- `NetflixBackend/utils/canPlayChecker.js`
- `NetflixBackend/utils/serverCanPlayControl.js`
- `NetflixBackend/scripts/check-pc-canplay.js`
- `.github/workflows/check-pc-canplay.yml`
- `NetflixBackend/.github/workflows/check-pc-canplay.yml`

Purpose:

- Let admin run a batch `canPlay` scan of PC cookies outside the request/response
  path by dispatching a GitHub Actions workflow.
- Store results in MongoDB as `CanplayCheckRun`.
- Optionally sync results back into `Cookie.canplayStatus` and `Cookie.isActive`.

Admin route behavior:

- `GET /api/admin/canplay/status`
  - returns GitHub workflow configuration, active workflow runs, latest local run,
    recent local runs, and the current Render server-check switch state.

- `GET /api/admin/canplay/server-check`
  - returns only the current Render server-check state for the lightweight Quick Action.

- `PUT /api/admin/canplay/server-check`
  - accepts `{ enabled: boolean }` and persists the live Render canplay switch.
  - does not stop or disable GitHub Actions batch checks.

- `POST /api/admin/canplay/start`
  - dispatches GitHub Actions workflow.
  - settings include workers, delayMs, blockWaitSec, maxAttempts, timeoutSec,
    activeOnly, limit, runLabel, allowConcurrent.

- `GET /api/admin/canplay/runs`
  - list recent runs without full results.

- `GET /api/admin/canplay/latest`
  - get full latest run.

- `GET /api/admin/canplay/runs/:id`
  - get full run by Mongo ID or runId.

- `POST /api/admin/canplay/runs/:id/sync`
  - sync completed run into `Cookie` documents.
  - rejects runs that do not declare the current
    `settings.ruleVersion=account-plan-payment-clcs-v2`.
  - resets canplay metadata only for Cookie IDs present in the selected run.
  - sets `isActive=false` for `NO_PLAY`.
  - keeps `UNKNOWN` active for recheck by default (`markUnknownAsDie=false`).
  - refuses partial runs unless explicitly allowed, to avoid resetting inventory from
    incomplete data.

Important admin UI behavior:

- Admin panel has a PC canplay modal/panel.
- The Render switch is outside the canplay modal: it appears in desktop sidebar Quick
  Actions and as a full-width mobile quick action. Both controls share one state and API.
  Turning it off affects new live checks (with a cache propagation window of at most
  about five seconds across multiple instances) and keeps the link/cookie fallback behavior.
- Cookie table shows canplay badges: `CAN_PLAY`, `NO_PLAY`, `UNKNOWN`, or not checked.
- Sync is a dangerous operation because it can mark cookies inactive. Confirm intent.

## 10. Auth Page Movie Showcase

This was also a major 2026-06-21 session focus.

Files:

- `NetflixFrontend/auth/index.html`
- `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
- `NetflixBackend/routes/auth-showcase.js`
- `NetflixBackend/routes/admin-showcase.js`
- `NetflixBackend/models/SystemConfig.js`

Public endpoint:

```text
GET /api/auth-showcase?country=VN
```

Admin endpoints:

```text
GET  /api/admin/showcase
POST /api/admin/showcase/validate
PUT  /api/admin/showcase
```

Storage:

```text
SystemConfig.key = "auth_showcase_config"
```

Current backend design:

- `admin-showcase.js` uses a fast local inventory (`STATIC_INVENTORY_ITEMS`) for the
  admin source list.
- Opening the admin Auth Showcase page should not call many TMDB/Watchmode requests.
- External APIs are called when admin manually enters an ID and clicks validate.
- The public auth showcase endpoint can also hydrate selected managed items from
  TMDB/Watchmode by `provider:mediaId` when the saved config lacks `image/heroImage`.
  This preserves the old "hardcoded ID -> automatic poster" behavior while keeping
  the admin inventory fast.
- `GET /api/admin/showcase` returns both the saved config and the inventory with
  `selected` markers.
- `PUT /api/admin/showcase` normalizes and saves enabled items with priority.
- `POST /api/admin/showcase/validate` validates TMDB or Watchmode IDs and returns
  title, year, origin, images, summary, source URL, etc.

Current public auth-showcase behavior:

- If managed config has active items, `auth-showcase.js` returns a fast
  `source: "managed"` payload without loading full Watchmode catalog.
- Managed config items are hydrated from TMDB/Watchmode with cache and timeout when
  their stored config is missing poster/backdrop metadata.
- Managed items can render even if they do not have real poster/backdrop data,
  because `createManagedRailItem` now creates an SVG fallback image.
- If there is no managed config, the route can still use Watchmode/TMDB dynamic
  selection and curated rails.
- The public route has `AUTH_SHOWCASE_RESPONSE_TIMEOUT_MS = 6500`; if dynamic data is
  too slow, it returns fallback instead of leaving the auth page loading forever.

Current admin UI behavior:

- PC sidebar includes `Auth Showcase`.
- The mobile admin action button for Auth Showcase was removed intentionally.
- The UI is intentionally simple: source inventory is a plain list with checkboxes.
- No poster cards in the admin inventory.
- Checked movies float to the top of the inventory.
- The separate "currently shown" panel was removed because selected checkboxes are
  enough to see what is active.
- Admin can add by TMDB/Watchmode ID. Validation is done before adding.

Current auth page behavior:

- If backend payload has `item.managedRail`, the auth page uses the first selected
  managed rail item as the hero/title/copy source.
- This fixed the bug where the four selected cards changed but the large intro text
  still showed the old featured movie (for example `Swapped`).
- The auth page renders up to four rail cards.

Important current curated IDs:

- TMDB `1528577`: `Thỏ Ơi!!` / `Bunny!!`
- Watchmode `3241552`: `Teach You a Lesson`
- Watchmode `3262115`: `If Wishes Could Kill`
- TMDB `988667`: `Thanh Sói`
- TMDB `1210973`: `Mai`

Do not store the Watchmode API key in this context file.

Known technical debt:

- `auth/index.html` contains earlier/duplicate showcase helper declarations before
  the later active block. The later block around the final `loadAuthShowcase` logic is
  the authoritative behavior.
- `auth-showcase.js` currently contains duplicated function names for
  `buildTmdbVietnamRailMeta` and `createTmdbVietnamRailItem`. The later definitions
  override earlier ones in JS. This should be cleaned in a focused refactor, but do
  not mix that cleanup into unrelated changes.
- `admin-showcase.js` still has some constants related to curated IDs that are no
  longer used by inventory loading because the inventory was switched to fast local
  data. Treat as harmless debt unless refactoring this route.

## 11. Collaborator / CTV Portal and Public API

Files:

- `NetflixFrontend/mK7xCtv9pR2026/index.html`
- `NetflixBackend/routes/ctv-auth.js`
- `NetflixBackend/routes/ctv.js`
- `NetflixBackend/routes/ctv-api.js`
- `NetflixBackend/routes/admin-ctv.js`
- `NetflixBackend/models/Collaborator.js`
- `NetflixBackend/models/CtvCookie.js`
- `NetflixBackend/models/CtvCookieLog.js`

Portal flow:

```text
CTV login
  -> POST /api/ctv-auth/login
  -> localStorage.ctv_token
  -> GET /api/ctv/me
  -> POST /api/ctv/get-cookies
       consume CtvCookie quota
       generate token link
       create CtvCookieLog
  -> history/regenerate/delete/API-key actions
```

Public API-key flow:

```text
External CTV site
  -> GET /api/ctv-api/get-cookie
       with X-API-Key or ?apikey=
  -> ctv-api-auth validates key and rate limits
  -> backend consumes CtvCookie and returns token link/quota info
```

CTV canplay behavior:

- `routes/ctv.js` and `routes/ctv-api.js` generate the token first, then call the live
  checker through `serverCanPlayControl.js` for both initial retrieval and regeneration.
- Confirmed `NO_PLAY` deactivates the `CtvCookie` and withholds the link.
- Missing/unrecognized plan withholds the link without deactivation.
- Timeout/connection/block, an admin-disabled live checker, or failure to read the
  switch returns the already-generated link as technical fallback without deactivation.

## 12. Chrome Extension

Files:

- `NetflixFrontend/TiemBanhNetflixExtension/manifest.json`
- `NetflixFrontend/TiemBanhNetflixExtension/background.js`
- `NetflixFrontend/TiemBanhNetflixExtension/content.js`
- `NetflixFrontend/TiemBanhNetflixExtension/web-content.js`
- `NetflixFrontend/TiemBanhNetflixExtension/popup.html`
- `NetflixFrontend/TiemBanhNetflixExtension/popup.js`

Purpose:

- Detect extension presence.
- Clear existing Netflix cookies.
- Inject selected Netflix cookie.
- Open/focus/reload Netflix tabs.
- Check Netflix page status (`/browse`, login page, error codes).
- Read browser cookies (`NetflixId`, `SecureNetflixId`) after user successfully
  reaches Netflix.

Important message/actions:

| Action/Event | Direction | Purpose |
| --- | --- | --- |
| `NetflixGuestExtensionReady` | extension -> page | Announces extension presence, version, extensionId. |
| `ping` | page -> extension | Basic readiness check. |
| `injectCookie` | page -> background | Clear old Netflix cookies and inject selected cookie. |
| `checkNetflixStatus` | page -> background/content | Verify Netflix status after injection. |
| `getSecureNetflixId` / `getNetflixCookies` | page -> background | Read `NetflixId` and `SecureNetflixId`. |
| `clearNetflixCookies` | page -> background | Clear Netflix cookies. |
| `forceReload` | background -> content | Force Netflix tab reload. |
| `showSuccessNotification` | background -> content | Show success UI on Netflix tab. |

Important security tie-in:

- Backend `/api/cookies/preview`, `/confirm`, and `/report-failed` expect an extension
  signal header such as `x-ext-infor`.
- Missing extension information can be treated as bot-like and can trigger abuse
  handling. Do not remove this from frontend requests unless you also redesign the
  backend safety model.

## Frontend Runtime Notes

### Static frontend, no clean component boundary

The frontend should be treated as several independent static apps:

- public main app
- auth app
- admin app
- CTV app
- extension scripts
- shop pages

They share config and some scripts, but there is no reliable global component model.
Always search for duplicate logic before changing behavior.

Mobile account quick actions:

- The first quick-action button is plan-aware: Free users see `Nâng cấp Pro Plan`,
  while Pro users see `Mua thêm credits` and open the credits purchase modal.
- Both states of this plan-aware button use the yellow purchase/upgrade accent on
  mobile so the primary paid action remains visually consistent.
- The former fixed `Mua thêm credits` quick action is now `Video hướng dẫn` and
  opens the shared YouTube guide. The action grid sits directly below the active
  Netflix App/TV panel with compact spacing.

Mobile App/TV tabs and payment modal:

- Under the mobile responsive layout (`max-width: 1024px`), the `NETFLIX APP` and
  `NETFLIX TV` controls are connected folder-style tabs rather than a detached card.
  The active tab has an open bottom edge that visually joins the active operation
  panel; the panel has no top border. Both tabs keep rounded top corners, and the
  inactive tab uses a light neutral surface so it remains visibly clickable.
- The tab accent follows the active panel: green for Netflix App and yellow for
  Netflix TV. These rules must stay mobile-only; desktop layout is intentionally
  unchanged.
- Under `max-width: 768px`, the payment modal's outer premium shell is visually
  removed (solid-black full-height surface, no border/radius/shadow). Its content
  uses the full mobile width, is vertically centered while it fits the viewport,
  caps the QR at 178px, and reduces typography/card/button spacing. Longer payment
  content starts at the top and remains vertically scrollable.
- On mobile, payment scrolling belongs to `#paymentModal` rather than its inner
  `.modal-content`. The overlay scrollbar is hidden for Firefox/WebKit, but vertical
  touch scrolling remains enabled, including iOS momentum scrolling.
- The mobile Credits purchase modal uses a full-height solid-black surface without
  the desktop card shell. Its service cards, amount/credit fields, quick choices,
  coupon area, summary, and buttons are compact. The content is vertically centered
  while it fits and remains internally scrollable with its scrollbar hidden when it
  does not. Desktop Credits modal styling is unchanged.
- The coupon-forfeit reminder is also compacted only under the mobile breakpoint;
  its desktop dimensions and typography remain unchanged.
- Every web page uses `maximum-scale=1.0, user-scalable=no` in its viewport so iOS
  does not zoom into compact form fields on focus. The browser-extension popup is
  separate from the mobile website and intentionally keeps its existing viewport.
- The mobile two-line text clamp declares both `-webkit-line-clamp: 2` and the
  standard `line-clamp: 2` compatibility property.

### `config.js`

`NetflixFrontend/config.js` sets:

```js
window.APP_CONFIG = {
  BACKEND_URL: "http://localhost:3000" or "https://api.tiembanh4k.com",
  ENVIRONMENT: "development" or "production"
}
```

Many frontend files fallback to hardcoded URL logic if `APP_CONFIG` is absent.

### Important localStorage keys

| Key | Used by | Meaning |
| --- | --- | --- |
| `auth_token` | main/auth frontend | User JWT. |
| `current_user` | auth/main frontend | Current user object. |
| `currentUser` | legacy frontend | Alias/legacy current user key. |
| `logged_in` | auth/main frontend | UI session marker. |
| `pending_tiembanh_token` | auth flow | Temporary auth token during modal/referral flows. |
| `pending_tiembanh_user` | auth flow | Temporary user object. |
| `pending_verification_token` | auth flow | Temp token for email verification. |
| `pending_registration` | auth flow | Registration/OTP pending state. |
| `forgot_password_email` | auth flow | Forgot password flow state. |
| `admin_token` | admin panel | Admin JWT. |
| `ctv_token` | CTV portal | Collaborator JWT. |
| `netflixTabOpened` | PC guest flow | Timestamp marker for opened Netflix tab. |

## Backend Middleware and Safety Rules

### Authentication middleware

- `middleware/auth.js`: verifies user JWT and may auto-downgrade expired Pro users.
- `middleware/admin-auth.js`: verifies admin token for admin routes.
- `middleware/ctv-auth.js`: verifies collaborator JWT.
- `middleware/ctv-api-auth.js`: validates collaborator API keys and rate limits public
  API calls.

### Email verification

`middleware/checkEmailVerified.js` is applied to service routes. A user can be logged
in but still rejected if email verification/status rules fail.

### Quota and credits

`middleware/checkQuota.js` is central for service usage. It resets user credit/quota
state as needed and blocks insufficient credits.

### Abuse detector

`middleware/abuseDetector.js` is security-critical.

It tracks:

- preview timestamps
- last preview time
- last report-failed/report-issue proof time
- report-failed streaks

Important rules:

- R1/R2: too many unaccounted preview requests.
- R4: too many report-failed events without successful confirm.
- R5: report-failed too soon after preview, which suggests automation rather than a
  real browser navigation.
- skipCurrent/excludeIds proof window: 5 minutes.

Do not casually weaken these rules. If a real-user false positive exists, fix the
frontend/backend proof timing and state machine rather than disabling abuse checks.

### Nonce manager

`middleware/nonceManager.js` issues and consumes one-time nonces. Preview and
report-failed rely on nonces to limit scripted replay.

## Session Changes From 2026-06-21

This section summarizes what was changed or clarified during the 2026-06-21 session.

### A. Watch as guest / canPlay / skipCurrent investigation and fixes

Observed symptoms:

- Some users could generate app/token links successfully.
- The same or similar users could fail on "Watch as guest".
- The UI could show "logging in" and later "login failed" or appear stuck.
- Backend logs showed `/api/cookies/preview` starting and then no immediate response.
- `skipCurrent=true DENIED` appeared intermittently.

Root cause model:

- "Generate link" and "Watch as guest" are not identical flows.
- Watch as guest depends on `/api/cookies/preview` returning a cookie to the extension.
- The preview route now does server-side `canPlay` before returning a cookie.
- If `canPlay` hangs or is slow, the extension never receives a cookie to inject.
- `skipCurrent=true` requires proof from report-failed/report-issue; if frontend sends
  it without proof, backend correctly denies or downgrades.

Implemented/current behavior:

- Live guest preview uses `findPlayableGuestCookie`.
- `canPlay` is bounded by `GUEST_CANPLAY_TIMEOUT_MS = 12000` and hard timeout wrapper.
- Up to 5 candidate cookies are tried.
- Confirmed no-play cookies are deactivated and synced inactive to mobile/CTV.
- Technical `canPlay` failures use extension fallback; eligibility uncertainty such
  as missing/unrecognized plan withholds the candidate without deactivating it.
- Frontend `CookieRetryHandler` only retries with skip/exclude after backend accepted
  report-failed proof.
- If report-failed fails, frontend stops instead of sending unsafe skipCurrent.
- Backend downgrades proofless `skipCurrent=true` to normal preview if no excludeIds
  are present, reducing false failures.
- Backend still treats proofless `excludeIds` as suspicious/abuse.

Operational note:

- Seeing `timeoutMs=12000` in logs is expected. It is the live guest-preview canPlay
  timeout per candidate, not a user-visible countdown.

### B. Admin PC canplay system documented as an active subsystem

The admin canplay panel is not a mock. It is connected to:

- `GET /api/admin/canplay/status`
- `GET /api/admin/canplay/server-check`
- `PUT /api/admin/canplay/server-check`
- `POST /api/admin/canplay/start`
- `GET /api/admin/canplay/latest`
- `POST /api/admin/canplay/runs/:id/sync`
- GitHub Actions workflow `.github/workflows/check-pc-canplay.yml`
- DB model `CanplayCheckRun`

Syncing a run can mark cookies inactive. Treat this as an operations tool.

### C. Auth Showcase management added and refined

Added/current backend:

- `routes/admin-showcase.js`
- `routes/auth-showcase.js` managed-config support
- `SystemConfig.auth_showcase_config`
- server route mount: `/api/admin/showcase`

Added/current admin UI:

- PC sidebar entry `Auth Showcase`.
- Source inventory list with checkboxes.
- Selected movies float to the top.
- Manual ID validation for TMDB/Watchmode.
- Save configuration to backend.
- Auth Showcase button removed from mobile admin UI.

Added/current auth page behavior:

- Auth page can render admin-selected movies.
- If managed rail exists, first selected movie drives the hero title, image, meta, and
  copy instead of stale dynamic featured copy.
- Auth page no longer keeps the old featured movie intro when selected cards change.

Performance fix:

- Admin showcase inventory now uses local static data so opening the admin panel does
  not wait for many TMDB/Watchmode requests.
- Auth showcase has a fast managed-config path and a 6.5s timeout fallback for
  dynamic Watchmode/TMDB mode.

### D. Auth-page movie IDs used/confirmed in session

- TMDB movie ID `1528577`: `Thỏ Ơi!!` / `Bunny!!`
- Watchmode title ID `3241552`: `Teach You a Lesson`
- Watchmode title ID `3262115`: `If Wishes Could Kill`

The Watchmode API key provided during the session must not be recorded here.

## Session Changes From 2026-07-15

This section records the pricing, login-link fallback, and mobile UI work completed
after the 2026-06-21 session notes above.

### A. Pro pricing, credit purchase rate, and service costs

The authoritative current commercial values are:

| Item | Current value |
|---|---:|
| Pro Plan | 40.000 VNĐ / 30 days |
| Credits granted on Pro upgrade/reset | 40 credits |
| Additional-credit rate | 1.000 VNĐ = 1 credit |
| Minimum additional-credit purchase | 40.000 VNĐ = 40 credits |
| PC Watch as guest | 1 credit |
| PC login link | 1 credit |
| Netflix TV activation | 2 credits |
| Netflix Mobile App login link | 2 credits |

Backend sources updated for these values:

- `NetflixBackend/models/User.js`: `PRO_MONTHLY_CREDITS = 40`.
- `NetflixBackend/routes/credits.js`: `CREDIT_PRICE_VND = 1000`, minimum purchase
  `40000`, round-thousand validation, and server-side credit calculation.
- `NetflixBackend/routes/cookies.js`: `PC_LOGIN_COST = 1`. Guest-watch confirmation
  remains a separate 1-credit flow.
- `NetflixBackend/routes/tv.js`: `TV_ACTIVATION_COST = 2` and
  `APP_LOGIN_COST = 2`.

Frontend surfaces updated to match the backend:

- `NetflixFrontend/index.html`: plan copy, payment modals, preset amounts, credit
  previews, insufficient-credit messages, TV/App confirmation dialogs, plan
  comparison, and PC-login cost label.
- `NetflixFrontend/app.js`: PC-login cost and Pro price copy.
- `NetflixFrontend/auth.js`: the global purchase-modal helpers now validate a
  minimum of 40.000 VNĐ, calculate at 1.000 VNĐ per credit, format the amount, update
  `creditsAmount`/`totalAmount`, and enable or disable the confirmation button safely.
  Do not reintroduce assumptions that a `creditsPreview` element exists.
- `NetflixFrontend/terms-of-service/index.html`: Pro pricing copy is 40.000đ/month.

When changing any price or cost again, update backend constants first and then search
all frontend apps for old values. `index.html` and `auth.js` both expose purchase
helpers, so they must remain aligned with the current DOM and backend validation.

### B. PC login-link canPlay strict parity

`POST /api/cookies/pc-login-link` now follows the same bounded quality-gate principle
as Mobile App login after a token has already been generated:

- one `canPlay` attempt with `PC_LOGIN_CANPLAY_TIMEOUT_MS = 12000`;
- a hard wrapper timeout at approximately 13 seconds;
- timeout/connection/block results return the generated token link as fallback;
- missing/unrecognized plan withholds the link without deactivating the cookie;
- confirmed no-play results deactivate the PC cookie, synchronize its
  Mobile/CTV derivatives inactive, and continue to another candidate.

Watch as guest, PC login, and App login normally require a positively proven CAN PLAY
result. The deliberate exception is an operational/technical fallback (timeout,
connection/block, disabled live checker, or unavailable control): return the candidate
cookie/already-generated link and keep inventory active. Missing/unrecognized plan is
not part of this exception.

### C. Mobile dashboard controls

- The four quick actions and logout area were moved closer to the active App/TV
  operation panel by reducing excess bottom/top spacing.
- `mobilePlanActionBtn` is plan-aware. Free opens the Pro upgrade flow; Pro changes
  its label/icon/action to `Mua thêm credits` and opens the credit purchase modal.
- The old fixed credit-purchase action is now `Video hướng dẫn` and opens the shared
  YouTube guide in a new tab with `noopener`.
- The paid plan/credits action uses the same yellow accent in both Free and Pro states.
- The App/TV selector and active panel are one connected tab component on mobile:
  no gap, no detached wrapper card, open active-tab bottom, visible inactive-tab
  surface, consistent rounded top corners, and panel-only lower corner rounding.
- These dashboard changes are scoped to mobile responsive CSS and must not alter the
  PC layout.

### D. Mobile payment modal compaction and scrolling

- The payment modal's outer premium container is removed visually only at
  `max-width: 768px`; desktop retains the original premium shell.
- Mobile content width is `min(calc(100% - 20px), 340px)`, QR maximum width is
  200px, and heading/body/button/card sizing is reduced to prevent horizontal or
  visual overflow.
- Grid, QR, and information columns explicitly use `width: 100%`, `min-width: 0`,
  and border-box sizing.
- `.modal-content` no longer owns a fixed-height inner scroll area on mobile. The
  overlay starts at the top, scrolls vertically by touch, hides the visible scrollbar,
  and preserves WebKit/iOS momentum scrolling.

### E. CSS compatibility cleanup

The mobile truncated-text rule now declares the standard `line-clamp: 2` alongside
`-webkit-line-clamp: 2`. This resolves the editor compatibility warning while keeping
the existing WebKit behavior.

## Session Changes From 2026-07-19

This section records the account-based canplay migration, operational Render switch,
admin UI changes, and local NetflixId tooling completed in this session.

### A. Canonical account-based canplay migration (payment portion superseded 2026-08-08)

All current product paths evaluate plan eligibility from `https://www.netflix.com/account`
through `NetflixBackend/utils/canPlayChecker.js`; payment eligibility additionally uses
the CLCS GraphQL operation documented in the canonical contract above. The former
`/browse`, movie-ID, PACS playback-capability, and CSS-hash payment approaches are
historical and must not be restored.

The current rule is `account-plan-payment-clcs-v2`:

1. Extract and recognize Premium, Standard, Basic, or Mobile plan information.
2. Reject a recognized plan if it is an ad-supported variant.
3. Query `CLCSInterstitialAccountPages` with the cookies collected from `/account`.
   Reject payment when the component tree contains `UPDATE_PAYMENT_METHOD` or
   `payment_failure_interstitial`; accept payment when the operation returns a null
   interstitial. Treat GraphQL errors or a missing/malformed successful payload as
   payment unknown; `null` alongside `errors` is not payment OK.
4. Reject login/signup responses as confirmed no-play.

Plan extraction strips HTML/CSS artifacts and normalizes known localized Netflix plan
labels into canonical categories. The Python UI then displays those categories in
Vietnamese. Recognition uses patterns plus localized markers, not only one literal mapping
table. Because Netflix can add new labels or change markup, an unrecognized result
intentionally remains `UNKNOWN`; it is never guessed as a playable plan.

Result handling deliberately distinguishes two kinds of uncertainty:

- Eligibility uncertainty (`Plan not found`, `Plan type not recognized`) withholds the
  cookie/link but does not deactivate inventory.
- Technical availability uncertainty (timeout, connection failure, block/rate limit,
  403/429/5xx, empty/error response) returns the cookie or already-generated token link
  as the legacy fallback and does not deactivate inventory.

This same contract is used by PC guest preview, PC login link, Mobile App Login, CTV
portal/API retrieval and regeneration, and the GitHub batch runner. Live routes go
through `serverCanPlayControl.js`; the batch runner calls `canPlayChecker.js` directly.

### B. Render live-check runtime control

`NetflixBackend/utils/serverCanPlayControl.js` adds an operational gate around live
outbound Netflix account requests:

- Config key: `SystemConfig.server_canplay_enabled`.
- Missing value defaults to `true` for backward compatibility.
- Disabled detail: `Server canPlay disabled`.
- Config-read failure detail: `Server canPlay control unavailable`.
- Both details use technical fallback, so service continues returning eligible
  candidate cookies/already-generated links without deactivation and without sending a
  Netflix request from Render.
- State reads use a five-second cache, deduplicate concurrent reads, and use a
  `stateVersion` guard so an older in-flight read cannot overwrite a newer admin change.

The admin API is:

- `GET /api/admin/canplay/server-check` for the lightweight current state.
- `PUT /api/admin/canplay/server-check` with `{ enabled: boolean }` to persist a change.
- `GET /api/admin/canplay/status` also includes `serverCheck` for the full canplay panel.

No Render restart is required after toggling. The instance processing the update sees
the value immediately; another running instance may take at most about five seconds.
Requests already inside a Netflix check are not canceled. The setting survives restart
and redeploy because it is stored in MongoDB. GitHub Actions is intentionally unaffected.

### C. GitHub batch and admin sync hardening

`NetflixBackend/scripts/check-pc-canplay.js` now uses the canonical checker directly and
writes artifacts with `schemaVersion: 2` and
`settings.ruleVersion=account-plan-payment-clcs-v2`. Both workflow copies must stay aligned:

- `.github/workflows/check-pc-canplay.yml` for the monorepo deployment.
- `NetflixBackend/.github/workflows/check-pc-canplay.yml` for the standalone backend repo.

Admin sync refuses older or unversioned runs, refuses partial runs unless explicitly
allowed, defaults `markUnknownAsDie=false`, and resets only Cookie IDs that were actually
part of the selected run. Thus newly added or excluded cookies cannot be accidentally
reactivated by a stale result set.

### D. Admin Render switch placement and responsive behavior

The Render switch was deliberately removed from the Check canplay modal. It now appears:

- on desktop as the `Render Canplay` item in the sidebar Quick Actions group;
- on mobile as a full-width quick action below the three primary action buttons and
  above `Thao tác khác`.

Both controls in `NetflixFrontend/x7Kv9mPq3nRt2025/index.html` use the shared
`[data-render-canplay-control]` state/UI logic and the same GET/PUT endpoints. State is
loaded after admin authentication. Do not add a second independent switch implementation
inside the modal.

### E. Local NetflixId tools

- `netflix_v2_netflixid.py` is the GUI conversion of the old SVB flow. It accepts a TXT
  file with one owned `NetflixId` per line instead of email/password input.
- `TokenGenerator/CookieChecker_v5.py` mirrors the account-based rule, displays Plan and
  Payment (`OK`/`FAIL`/`UNKNOWN`), calls the same CLCS persisted GraphQL operation after
  `/account`, and uses the rendered semantic alert only as an HTML fallback. It removes
  Payment Method/Next Billing from the current table.
- Plan text is HTML-cleaned and normalized for multilingual labels. Unknown plan text is
  not cached as a confirmed result; confirmed results use a 60-second cache.
- Technical `UNKNOWN` still returns the generated token/link. Eligibility `UNKNOWN`
  withholds it. CSV/TXT export includes a dynamic plan selector populated from the
  checked LIVE results; the selected plan is always combined with `Payment=OK`. Premium
  remains the preferred default when present, while localized or newly observed plan
  names can also be selected without adding another hard-coded export option.

### F. Verification completed for the 2026-07-19 handoff (historical)

- Backend test suite passed via `npm.cmd test`, including account parsing/classification,
  disabled mode making zero outbound HTTPS calls, control-read fallback, default/persisted
  state, stale-read race protection, and enabled forwarding to the canonical checker.
- `test_netflix_v2_netflixid.py`: 13 tests passed.
- All changed backend JavaScript files passed syntax checks and module-load checks.
- Both admin inline scripts parsed successfully; GET/PUT routes were confirmed mounted.
- Both workflow YAML files and backend package JSON parsed successfully.
- Static desktop/mobile breakpoint inspection passed. A live CTV smoke test was not run
  because it would consume or mutate a real cookie; perform that test with controlled
  inventory if needed.

## Session Changes From 2026-08-08

### A. Payment classification moved from CSS markup to CLCS GraphQL

Two sanitized Chrome HAR captures, one payment-healthy account and one payment-failed
account, established the client-side source of truth:

- Both pages load plan/account HTML from `GET /account`.
- Both call the persisted GraphQL operation `CLCSInterstitialAccountPages` at
  `https://web.prod.cloud.netflix.com/graphql` with variables `format=HTML`,
  `resolutionMode=WEB_1X`, and `accountSubpage=/account`.
- The healthy account returns `data.clcsInterstitialAccountPages=null` without GraphQL
  errors.
- The failed account returns a CLCS component tree containing
  `testId=UPDATE_PAYMENT_METHOD`; its feedback metadata also identifies
  `workflowName=payment_failure_interstitial`.
- The warning banner is rendered after the initial HTML response. DevTools `Elements`
  therefore shows it even when a plain HTTP client cannot find it in `resp.text`.

The former `p.default-ltr-iqcdef-cache-r98rqt` detector was removed as the authority.
Netflix CSS hashes vary by rollout and ordinary payment-healthy paragraphs can use the
same generated class prefix. Do not restore class-prefix or localized-text matching.

### B. Runtime implementation

`NetflixBackend/utils/canPlayChecker.js` now:

1. Fetches `/account`, follows redirects, and retains Netflix `Set-Cookie` values in a
   small per-check cookie jar.
2. Validates plan eligibility first. Missing/unrecognized plans remain withheld and
   ad-supported plans remain confirmed no-play without depending on CLCS availability.
3. Extracts the current Netflix UI/Hawkins versions from account HTML for request headers.
4. Calls the CLCS persisted query with the same session only for recognized non-ad plans.
5. Classifies null interstitial as payment OK and the stable payment action/workflow
   markers as payment FAIL.
6. Returns `Payment status unknown` for a structurally inconclusive successful payload.
   A payload containing GraphQL `errors` is never accepted as payment OK, even if its
   data field contains a null interstitial.
   GraphQL timeout, connection error, 403/429/5xx, empty response, or invalid response
   remains a technical failure and follows existing fallback/non-deactivation policy.
7. Uses one shared per-attempt timeout budget across `/account` and CLCS so bounded live
   routes do not accidentally double their wait time.

The batch runner `NetflixBackend/scripts/check-pc-canplay.js` keeps its global pacing and
cooldown logic but now retains the same cookie session and calls the shared CLCS payment
helper. Live routes still go through `serverCanPlayControl.js`; batch runs remain
independent of the Render switch.

The HTML semantic check (`role=alert` plus `data-uia=UPDATE_PAYMENT_METHOD`) remains only
as a fallback for already-rendered/synthetic HTML and for unit tests. Product network
classification uses the GraphQL payload.

The persisted-query ID is deployment-sensitive Netflix metadata, not a credential. If
Netflix rotates it or changes the operation schema, the request should fail closed to
`UNKNOWN`/technical fallback. Capture a new sanitized HAR and update both backend and
Python constants together; never compensate by guessing payment OK.

### C. Batch compatibility and local tooling

- `CANPLAY_RULE_VERSION` and the admin UI expectation are now
  `account-plan-payment-clcs-v2`. Admin sync rejects `account-plan-payment-v1` results,
  requiring a fresh batch before inventory can be changed under the new rule.
- `TokenGenerator/CookieChecker_v5.py` uses the same operation, persisted-query ID,
  runtime-version headers, and OK/FAIL/UNKNOWN behavior.
- The local Python checker was validated against both captured HAR responses: healthy
  classified OK and failed classified FAIL.
- HAR files may include nftoken URLs or account metadata even when exported sanitized.
  Keep diagnostic HARs out of Git and delete them after the investigation is complete.

### D. Verification completed

- `NetflixBackend`: `npm.cmd test` passes with CLCS null, payment-failure, session-cookie,
  technical fallback, runtime switch, and existing plan/ad classification coverage.
- `test_netflix_v2_netflixid.py`: 19 tests pass.
- Updated JavaScript files pass `node --check`.
- Both captured HAR GraphQL responses classify correctly through the new backend and
  Python payload classifiers without printing credentials.

## Known Technical Debt and Sharp Edges

### 1. Large inline frontend files

`index.html`, `auth/index.html`, admin HTML, and CTV HTML are very large. They contain
CSS, markup, and JavaScript in one file. Search before editing.

### 2. Duplicate showcase functions in auth page

`NetflixFrontend/auth/index.html` contains earlier/legacy `renderShowcase` and
`loadAuthShowcase` declarations before later, more complete declarations. The later
declarations are the ones that matter at runtime due to function override/hoisting in
the same script scope.

### 3. Duplicate helper definitions in auth-showcase backend

`NetflixBackend/routes/auth-showcase.js` currently has duplicated definitions for:

- `buildTmdbVietnamRailMeta`
- `createTmdbVietnamRailItem`

The later versions override earlier ones. Clean this in a dedicated refactor only.

### 4. Old code after early returns

Some routes, especially in `cookies.js` and `server.js`, contain dead legacy code
after early `return` statements. Be careful when reading: the first active return may
make later code unreachable.

### 5. Hardcoded/admin-sensitive values

Some credentials or URLs may be hardcoded in admin/auth/config files. Do not copy
secrets into this document. Prefer environment variables in future refactors.

### 6. `smsOtpLeft` naming is misleading

It currently represents OTP email quota, not necessarily SMS.

### 7. Frontend auth still has legacy local/demo traces

`auth.js` includes old local-user helpers and demo-like logic. Do not assume every
function is part of the active production path without tracing actual calls.

### 8. CORS and origin checks are independent

Backend CORS may allow a domain, but `abuseDetector.checkOrigin` and route-specific
extension headers still enforce additional policy. A request can pass CORS and fail
security checks.

## Debugging Playbooks

### Watch as guest hangs before extension injection

Check:

1. Browser network request to `/api/cookies/preview`.
2. Backend logs around:
   - `👀 [Guest Preview] ℹ️ Request`
   - `👀 [Guest Preview] ✅ Cookie selected`
   - `👀 [Guest Preview] ⚠️ Playback failed`
   - `👀 [Guest Preview] ⚠️ Using extension fallback`
   - Temporarily set `FLOW_LOG_VERBOSE=true` if per-attempt canPlay timing is required.
3. Whether response is delayed longer than expected.
4. Whether extension info header is present.
5. Whether nonce is present and valid.
6. Whether `skipCurrent`/`excludeIds` was sent without proof.

Expected after fixes:

- Slow/inconclusive `canPlay` should not hang forever.
- Technical `canPlay` failure should return the cookie as fallback and leave it active.
- Confirmed no-play should deactivate that cookie and try another.

### Render IP is blocked or rate-limited by Netflix

Symptoms include repeated hard timeouts, 403/429 responses, or technical fallback logs
for otherwise valid inventory.

Operational response:

1. In the admin sidebar/mobile Quick Actions, turn off `Render Canplay`.
2. No server restart is needed. Allow up to about five seconds for another Render
   instance to observe the change.
3. Confirm new live requests log/detail `Server canPlay disabled`, return the candidate
   cookie/already-generated link, and do not deactivate inventory.
4. Continue using the independent GitHub Actions batch checker for eligibility audits.

Turning the switch off does not cancel an already-running request. If the admin endpoint
cannot read MongoDB, live checking fails safely to `Server canPlay control unavailable`
instead of sending an uncontrolled Netflix request.

### Payment-failed account is reported as payment OK or UNKNOWN

Check:

1. Capture Chrome Network after reloading `/account` and waiting for the banner; the
   initial Document/DevTools Elements alone is insufficient.
2. Find the `CLCSInterstitialAccountPages` POST to
   `web.prod.cloud.netflix.com/graphql`.
3. Healthy response should contain `clcsInterstitialAccountPages:null`.
4. Failed response should contain `UPDATE_PAYMENT_METHOD` or
   `payment_failure_interstitial` in the returned component tree/feedback metadata.
5. Confirm the checker retained cookies set by `/account` and extracted current UI and
   Hawkins versions. A non-200/empty/malformed CLCS response must be UNKNOWN or technical
   fallback, never guessed as OK.

Do not debug this by copying only the rendered warning element or by adding another CSS
hash. Use a sanitized HAR and compare the GraphQL responses.

### `skipCurrent=true DENIED`

Ask:

- Did `/report-failed` succeed immediately before retry?
- Did user manually refresh/retry after server lost in-memory proof?
- Did request include `excludeIds` without proof?
- Did frontend set `hasRetryProof`?
- Is `User.lastReportTime` recent if this came from report-issue?

Expected:

- Real retry after backend-accepted report-failed should be allowed.
- Direct scripted skip/exclude without proof should be denied or banned.

### Auth Showcase admin loads slowly

After the 2026-06-21 fix, this should not depend on many external API calls.

Check:

- `GET /api/admin/showcase`
- whether backend restarted after code changes
- MongoDB connectivity
- admin token validity

Only manual ID validation should call TMDB/Watchmode.

### Auth page showcase stays on loading screen

Check:

- `GET /api/auth-showcase?country=VN`
- whether backend route has restarted
- if `auth_showcase_config` has active items
- if Watchmode/TMDB dynamic mode is timing out

Expected:

- Managed config should return quickly.
- Dynamic mode should timeout to fallback after about 6.5 seconds.

### Admin canplay sync risk

Before syncing:

- Make sure run is `completed`.
- Avoid syncing partial runs unless intentionally allowed.
- Keep `markUnknownAsDie=false` unless intentionally treating inconclusive network/
  parser results as dead inventory.
- Sync can mark many cookies inactive.

## Environment and Deployment Notes

Backend expected env variables include, but are not limited to:

- `MONGO_URI`
- JWT secret(s)
- Brevo email credentials
- `WATCHMODE_API_KEY`
- `TMDB_READ_TOKEN`
- GitHub Actions canplay config:
  - `GITHUB_ACTIONS_TOKEN` or `GITHUB_TOKEN`
  - `GITHUB_CANPLAY_REPOSITORY` or owner/repo variables
  - `GITHUB_CANPLAY_WORKFLOW`
  - `GITHUB_CANPLAY_REF`

Frontend production backend URL is configured in `NetflixFrontend/config.js` as
`https://api.tiembanh4k.com`; localhost uses `http://localhost:3000`.

The Dev Launcher (`dev_launcher.py`) is used locally to run frontend/backend together.
When backend route code changes, restart backend from Dev Launcher before testing.

The `server_canplay_enabled` value is runtime MongoDB state, not an environment variable.
Changing it through the admin Quick Action requires no restart or redeploy. Deploy backend
support before deploying the frontend control, because the UI depends on the dedicated
GET/PUT admin endpoints. The default is enabled when the key does not yet exist.

## Verification Commands Used Recently

Useful syntax checks:

```powershell
node --check NetflixBackend/routes/admin-showcase.js
node --check NetflixBackend/routes/auth-showcase.js
node --check NetflixBackend/routes/admin-canplay.js
node --check NetflixBackend/routes/cookies.js
node --check NetflixBackend/utils/canPlayChecker.js
node --check NetflixBackend/utils/serverCanPlayControl.js
```

Current automated checks:

```powershell
Set-Location NetflixBackend
npm.cmd test
Set-Location ..
python -m unittest test_netflix_v2_netflixid.py
```

Inline script parse check:

```powershell
node -e "const fs=require('fs'); for (const f of ['NetflixFrontend/auth/index.html','NetflixFrontend/x7Kv9mPq3nRt2025/index.html']) { const html=fs.readFileSync(f,'utf8'); const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()); scripts.forEach(s=>new Function(s)); console.log(f+': '+scripts.length+' inline scripts OK'); }"
```

Local endpoint smoke checks, if backend is running:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/auth-showcase?country=VN -TimeoutSec 9
```

Admin endpoints require a valid `admin_token`; do not test them as public endpoints.

## Quick Task Navigation

### Change PC guest-watch behavior

Read/edit:

- `NetflixFrontend/cookie-retry-handler.js`
- `NetflixFrontend/app.js`
- `NetflixBackend/routes/cookies.js`
- `NetflixBackend/middleware/abuseDetector.js`
- `NetflixBackend/middleware/nonceManager.js`

Do not ignore:

- extension header requirement
- nonce
- skipCurrent proof
- credit deduction in `/confirm`
- PC -> Mobile -> CTV inactive sync

### Change server-side canPlay logic

Read/edit:

- `NetflixBackend/utils/canPlayChecker.js`
- `NetflixBackend/utils/serverCanPlayControl.js`
- `NetflixBackend/routes/cookies.js`
- `NetflixBackend/routes/tv.js`
- `NetflixBackend/routes/ctv.js`
- `NetflixBackend/routes/ctv-api.js`
- `NetflixBackend/routes/admin-canplay.js`
- `NetflixBackend/scripts/check-pc-canplay.js`
- `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
- `TokenGenerator/CookieChecker_v5.py`

Remember:

- Live routes use the runtime wrapper; GitHub batch calls the canonical checker directly.
- Live routes return fallback only for technical/operational failures. Missing or
  unrecognized plan is not an availability fallback.
- `server_canplay_enabled=false` skips outbound Netflix checks on live Render paths but
  does not disable GitHub Actions.
- Batch admin canplay can mark inventory inactive when synced.
- Payment requires the CLCS GraphQL response from the same `/account` session. Do not
  infer payment from a CSS class, class prefix, or translated warning copy.
- Bump `CANPLAY_RULE_VERSION` and the admin UI expectation whenever a classification
  change would make old batch results unsafe to sync.

### Change auth/register/OTP

Read/edit:

- `NetflixFrontend/auth.js`
- `NetflixFrontend/auth/index.html`
- `NetflixBackend/routes/auth.js`
- `NetflixBackend/models/PendingVerification.js`
- `NetflixBackend/models/SystemConfig.js`

Remember:

- `smsOtpLeft` is email OTP quota.
- Login can be allowed while service use is still blocked by verification middleware.

### Change Auth Showcase

Read/edit:

- `NetflixFrontend/auth/index.html`
- `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
- `NetflixBackend/routes/auth-showcase.js`
- `NetflixBackend/routes/admin-showcase.js`
- `NetflixBackend/models/SystemConfig.js`

Remember:

- Admin inventory is intentionally simple and local-fast.
- Manual validation is the only admin action that should call TMDB/Watchmode.
- Auth page hero should follow first selected managed item.
- Mobile admin UI intentionally does not expose Auth Showcase.

### Change pricing or credit costs

Read/edit:

- `NetflixBackend/models/User.js`
- `NetflixBackend/routes/credits.js`
- `NetflixBackend/routes/cookies.js`
- `NetflixBackend/routes/tv.js`
- `NetflixFrontend/index.html`
- `NetflixFrontend/auth.js`
- `NetflixFrontend/app.js`
- `NetflixFrontend/terms-of-service/index.html`

Remember:

- Backend constants and validation are authoritative.
- Search every frontend surface for old price, rate, grant, and service-cost copy.
- `index.html` and `auth.js` both define credit-purchase helpers and must agree on DOM
  IDs, minimum amount, formatting, calculation, and confirmation-button state.

### Change public mobile dashboard or payment UI

Read/edit:

- `NetflixFrontend/index.html`
- `NetflixFrontend/auth.js` if credit-purchase modal behavior changes

Remember:

- Main dashboard responsive rules live primarily under `max-width: 1024px`.
- Payment-modal compaction and overlay scrolling are scoped under `max-width: 768px`.
- Preserve the connected App/TV tab geometry and keep the inactive tab visible.
- `updateMobilePlanAction` and `handleMobilePlanAction` control the plan-aware quick
  action; CSS alone is not enough when changing its Free/Pro behavior.
- `updateDesktopPlanAction` keeps the PC account action plan-aware: Free upgrades Pro,
  while Pro purchases additional Credits.
- Do not let mobile-only visual changes alter the desktop premium modal or PC layout.

### Change TV activation/app-login

Read/edit:

- `NetflixBackend/routes/tv.js`
- `NetflixBackend/models/MobileCookie.js`
- `NetflixBackend/utils/tokenGenerator.js`
- `NetflixBackend/utils/canPlayChecker.js`
- `TokenGenerator/`

Remember:

- Needs both `NetflixId` and `SecureNetflixId`.
- `wrongCodeCount` is a proven-cookie-bad heuristic, not simply user typo count.
- There is a mobile-switch bypass window.

### Change admin user/cookie management

Read/edit:

- `NetflixFrontend/x7Kv9mPq3nRt2025/index.html`
- `NetflixBackend/routes/admin.js`
- `NetflixBackend/routes/admin-users.js`
- `NetflixBackend/routes/admin-cookies.js`
- `NetflixBackend/routes/admin-rate-limit.js`
- `NetflixBackend/routes/admin-ctv.js`
- `NetflixBackend/routes/admin-canplay.js`

Remember:

- Admin UI is a single large HTML app.
- Many admin route files are mounted under different base paths.
- PC and mobile admin UX can differ intentionally.

### Change CTV collaborator portal/API

Read/edit:

- `NetflixFrontend/mK7xCtv9pR2026/index.html`
- `NetflixBackend/routes/ctv-auth.js`
- `NetflixBackend/routes/ctv.js`
- `NetflixBackend/routes/ctv-api.js`
- `NetflixBackend/models/Collaborator.js`
- `NetflixBackend/models/CtvCookie.js`
- `NetflixBackend/models/CtvCookieLog.js`

Remember:

- Portal JWT and public API key are different auth modes.
- `CtvCookieLog.source` distinguishes portal/API usage.
- Initial retrieval and regeneration both use the live canplay wrapper. Preserve the
  technical/disabled fallback and do not deactivate an eligibility-unknown cookie.

## Mental Model Checklist for Future AI

Before making non-trivial changes, be able to answer:

1. Does this touch PC `Cookie`, `MobileCookie`, or `CtvCookie`?
2. Is this preview-only or confirmed assignment?
3. Does this path require extension info?
4. Does this path require nonce?
5. Does skip/exclude have valid proof?
6. Can this deduct credits? Is there a bypass window?
7. Does this route sync inactive state from PC to Mobile to CTV?
8. Is this a live check controlled by `server_canplay_enabled`, or an independent GitHub
   batch check that must record the current rule version?
9. Is this frontend code duplicated in inline HTML and a JS file?
10. Does this affect hidden admin or CTV surfaces?

If you cannot answer these questions, read the relevant sections and files before
editing.
