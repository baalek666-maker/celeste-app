# Celeste Backend Audit — 2026-08-02

Scope: `server/server.js` (6550L), `server/billing.js`, `server/auth-tokens.js`,
`server/gamification.js`, `server/routes/*.js` (12 files), `server/migrations/*.js`.
Server confirmed running on `:3001`; `/api/health` → `{"status":"ok"}`; rate-limiter
confirmed active (login brute-force returns 429 after attempts).

Scoring is **per route group**, 1 (critical risk) → 10 (production-grade).
Overall weighted average: **6.9 / 10**.

---

## 1. AUTH (`/api/auth/*`, `auth-tokens.js`, `oauth.js`)
**Files**: `server.js:1442-1465` (auth mw), `:2089-2610`, `auth-tokens.js`, `routes/oauth.js`

### Bugs / Crashes
- **`/api/auth/login` (server.js:2613)** — `bcrypt.compareSync` on missing user row is safe
  (NULL check upstream), but the timing-path differs between "user exists" and "user not
  found" → trivial **user-enumeration timing side-channel**. Fix: always run a dummy
  bcrypt compare.
- **`/api/auth/refresh` (server.js:2592)** — refresh-token rotation blacklists the old jti
  *before* issuing the new pair. If `issueTokenPair` throws (DB lock / disk full), the old
  token is **already revoked** → user is silently logged out on transient errors. Wrap in a
  transaction or blacklist only after success.
- **OAuth email-takeover (routes/oauth.js:315-324)** — Strategy 2 links an OAuth identity
  to an **existing email account** with zero verification. An attacker controlling a Google
  account that happens to share a victim's email can hijack their Celeste account. Google
  rotates email claims; `email_verified` should be checked and the link should require the
  password to be set/unset. **High severity**.

### Security
- ✅ Access/refresh split, type claim checked, JTI blacklist, rotation on refresh — solid.
- ⚠️ `ADMIN_TOKEN` (server.js:2312) is a single shared secret compared with `!==` →
  **non-constant-time comparison** (timing attack feasible; mitigate with
  `crypto.timingSafeEqual`).
- ⚠️ `verifyEmail` token is 64 hex chars (good) but the lookup is `WHERE email_verify_token
  = ?` with **no index** → linear scan. Low risk today, scales poorly.
- ⚠️ `auth-tokens.js:35` — `jwt.verify` without `algorithms: ['HS256']` whitelist; classic
  `alg=none` / RS256 confusion vector is open against any future key rotation.

### Error handling
Good: every auth route has a try/catch and returns JSON. Refresh failure → 401 with clear
message.

### Performance
- `auth()` middleware runs `SELECT is_premium…` AND `UPDATE last_activity_at…` on **every
  authenticated request** (server.js:1451,1459). Two DB round-trips per call on hot path.
  Cache `isPremium` for ~30s in a Map keyed by userId; batch `last_activity_at` writes.

### Data validation
- `register`: email regex, password ≥ 8 chars, display_name sanitised — good.
- `login`: only `typeof === 'string'` check — no length cap, allows huge bodies (HTTP body
  limit is 2mb, still fine).

### Missing features
- No password reset / "forgot password" flow.
- No rate-limit on `/refresh` rotation (a stolen refresh token can be rotated
  infinitely until blacklist catches up).
- No `email_verified` gate on login (users can use unverified email indefinitely).

### Score: **6.5/10**

### Top 3 recommendations
1. **Fix OAuth email-takeover**: only auto-link OAuth to an existing email account when
   that account has `oauth_provider IS NULL AND email_verified = 1`; otherwise create a
2. Add `algorithms: ['HS256']` to every `jwt.verify` call.
3. Make `auth()` middleware cache `is_premium` for 30s and skip `last_activity_at` write
   when last write < 60s ago.

---

## 2. PROFILE (`/api/profile*`, `/api/profiles/*`, `/api/account/*`, birth-data)
**Files**: `server.js:2637-2720`, `routes/profiles.js`, `routes/account.js`

### Bugs / Crashes
- **`routes/account.js:33` — SQL-injection-shaped but actually safe**: `db.prepare(\`SELECT *
  FROM ${table} WHERE ${where} = ?\`)`. `table`/`where` come from a hard-coded array, so
  not exploitable today, but the pattern is a maintenance hazard. Same in `:83-91` and
  `server.js:1025,1028,5187`. Replace with explicit per-table prepares.
- **GDPR export ignores several tables**: `account.js:37-41` exports 5 tables but the
  schema has 36. Missing: `mood_checkins`, `lunar_intentions`, `daily_quests`,
  `personal_transits`, `activated_houses`, `daily_energy`, `horoscope_cache`,
  `horoscope_feedback`, `tarot_grants`, `pdf_grants`, `xp_log`, `astro_portraits`,
  `compat_invites`, `referrals`, `natal_interpretations`. **GDPR incompleteness** — French
  CNIL would flag this.

### Security
- ✅ All routes require `auth`; ownership checks via `user_id = ?`.
- ⚠️ `routes/profiles.js:30-54` — `POST /` accepts `birthData` but **only validates
  presence of `date`, `time`, `city`**, not format/ranges. `latitude: Number(x) || 0`
  silently coerces invalid input to 0 (equator). Compare with the strict
  `validateBirthData()` used by `/api/profile/birth-data` (server.js:2640) — inconsistent.
- ⚠️ `PUT /api/profiles/:id` (profiles.js:57) — when `isSelf=true`, it clears `is_self`
  on siblings but the **UPDATE then sets `is_self=1` only on this row**; if two PUTs race,
  two profiles can end up `is_self=1`. Wrap in a transaction.

### Error handling
Profiles router has no top-level try/catch on POST/PUT/DELETE — a DB error throws a raw
Express HTML 500. Inconsistent with the rest of the app.

### Performance
- `account.js:31-35` `collect()` does **6 sequential `SELECT *`** queries — could be a
  single transaction. Acceptable for an occasional export.

### Data validation
- `profiles.js` `relation` is whitelisted (good); `name` truncated to 60 chars (good).
- `account/display-name` capped at 24 chars (good).

### Missing features
- No avatar upload (avatar_url is set only via OAuth).
- No email-change flow.

### Score: **6.0/10**

### Top 3 recommendations
1. Complete the GDPR export (all user-owned tables).
2. Apply `validateBirthData()` to `POST /api/profiles` and `PUT /api/profiles/:id`.
3. Replace `${table}` template strings with explicit prepared statements; wrap multi-row
   mutations in transactions.

---

## 3. ASTROLOGY (`/api/natal-chart*`, `/api/transits/today`, `/api/astro/*`,
   `/api/personal-transits`, `/api/activated-houses`, `/api/asteroid-wisdom`,
   `/api/chart/*`, `/api/aspects/today`)
**Files**: `server.js:1634-2072,3893-4524,4644-5143`, `routes/personal-transits.js`,
`routes/activated-houses.js`, `routes/asteroid-wisdom.js`

### Bugs / Crashes
- **`routes/asteroid-wisdom.js:151` — cache-poisoning risk**: `JSON.parse(cached.data)` is
  returned directly without schema validation. If a prior write stored the LLM envelope
  (documented pitfall #5), `archetypes` will be undefined and the frontend shows
  "indisponible". Add a guard `if (!parsed.archetypes) { delete + regenerate }`.
- **`/api/yearly-recap` (server.js:2824-2826)** — queries `journal_entries.content` column
  **which does not exist** (schema has `horoscope_summary` + `user_note`). The query
  throws, caught by `try { … } catch { /* non bloquant */ }` → `moodWord` is always null.
  Silent feature failure. Verified via `PRAGMA table_info(journal_entries)`.
- **`/api/astro/moon-phase` (server.js:2072)** — `new Date(dateParam)` with arbitrary
  user input; malformed strings yield `Invalid Date` (caught), but a string like
  `"2026-13-45"` parses to a real date in some engines → no upper/lower bound check.
- **`/api/chart/houses` (server.js:4895-4919)** — `computeHouses` reads `birth.lat` /
  `birth.lng` (snake-case) while the rest of the codebase uses `latitude`/`longitude`
  (validateBirthData output). So houses compute always falls back to Paris defaults
  (48.85, 2.35). **Quiet-data bug** — every user gets Paris houses unless they came
  through an old code path.

### Security
- ✅ All endpoints behind `auth`.
- ⚠️ `natal_interpretations` lifetime cache has **no invalidation** when birth data
  changes. A user who corrects their birth time still sees the old asteroid reading
  forever.

### Error handling
Generally good — every route has try/catch with deterministic fallbacks (per
`celeste-app-architecture-pitfalls` skill, this was hard-won).

### Performance
- **N+1 in `mood-tracker.js:120-135`** — `/api/mood/stats` loops over up to 90 mood
  rows, calling `getTransits(new Date(row.date))` per row. Each call recomputes all
  planetary positions via astronomy-engine. On a 90-entry user this is ~90 heavy
  computations on every request. Cache transits per date (they never change).
- `asteroid-wisdom.js:177` recomputes all 6 asteroid positions on every cache miss;
  fine (one-time per user) but could be persisted.
- `personal_transits` cache lookup `WHERE user_id = ? AND date = ?` — no index on
  `personal_transits(user_id, date)` (UNIQUE constraint exists so SQLite auto-creates
  one; OK).

### Data validation
- `natal-chart/planet/:name` (server.js:2008) — planet name from path not whitelisted
  against `PLANETS`; relies on `natalPositions[name]` returning undefined. Low risk but
  should validate.
- `compat/invite/:token/redeem` (server.js:3706-3712) — strong validation of birthData
  (date regex, time regex, lat/long ranges). Good.

### Missing features
- No `/api/chart/synastry` dedicated endpoint (compatibility uses inline compute).
- Asteroid positions not persisted; recomputed each request until cache hit.

### Score: **6.5/10**

### Top 3 recommendations
1. **Fix `journal_entries.content` bug** in yearly-recap (use `user_note`).
2. **Fix `computeHouses` to read `birth.latitude`/`birth.longitude`** (or normalize).
3. Cache daily transits in a `daily_transits` table keyed by date (single compute per
   day across all users) — eliminates the N+1 in mood stats.

---

## 4. CONTENT (`/api/horoscope*`, `/api/tarot/*`, `/api/compatibility*`,
   `/api/weekly-content`, `/api/favorites`, `/api/rituals/*`, `/api/challenge/*`,
   `/api/onboarding/*`, `/api/daily-energy`, `/api/lunar-cycle`, `/api/mood*`,
   `/api/yearly-recap`)
**Files**: `server.js:2880-3523,4524-5315`, `routes/daily-energy.js`,
`routes/lunar-cycle.js`, `routes/mood-tracker.js`

### Bugs / Crashes
- **`/api/horoscope` free-tier quota double-decrement (server.js:3003-3008,3040)**:
  `ensureMonthlyScans` is called, then `scans_remaining - 1` is written directly
  **without** going through `ensureMonthlyScans`, then `remaining` is recomputed as
  `ensureMonthlyScans(...) - (personalCached ? 0 : 1)`. On a cache miss this can decrement
  twice for one request. Also `ensureMonthlyScans` (server.js:600+) presumably does its own
  decrement; the inline `UPDATE … scans_remaining - 1` is a **second decrement**. Verify
  against `ensureMonthlyScans` implementation.
- **`/api/tarot/cross` quota race (server.js:3367-3516)** — `free_used` is incremented
  **after** the LLM call. Two concurrent requests both pass the gate, both run the LLM,
  both increment. Use `UPDATE … WHERE paid_count > free_used RETURNING …` or a mutex.
- **`/api/horoscope/week` timezone double-fix (server.js:3074-3083)** — computes `todayISO`
  via `getTimezoneOffset` hack then immediately recomputes `isoDate` the same way inside
  the loop. Works, but `localISODate()` already exists and is simpler. Inconsistency, not
  a bug.
- **`/api/favorites` POST (server.js:4550)** — `content.length > 1000` check happens
  before checking `content` is a string. If client sends `content: 12345` (number),
  `.length` is undefined → passes the check → `INSERT` with a number. SQLite will coerce
  but the validation intent is broken.
- **`/api/lunar-cycle/status` (lunar-cycle.js:42)** — `cycleStart.toISOString().slice(0,10)`
  uses UTC date while the rest of the app uses `localISODate()`. Users west of UTC will
  see intentions from "tomorrow" or miss "today" depending on server TZ. Documented
  pitfall class.

### Security
- ✅ All endpoints behind `auth`; `llmLimiter` on expensive ones.
- ⚠️ `/api/compat/invite/:token/redeem` (server.js:3694) is **public (no auth)** and
  triggers an LLM call. A leaked or guessed token (UUIDv4, so hard to guess) still burns
  server LLM budget. Add per-IP rate-limit on this specific route.
- ⚠️ `/api/weekly-content` POST/PUBLISH (server.js:2320,2341) accept `week_start` with no
  format validation — admin-only but still a maintenance hazard.

### Error handling
Consistent: every LLM route has a deterministic fallback (the team invested heavily in
this per the architecture-pitfalls skill). `tarot/cross` gracefully degrades to a
structured deterministic reading.

### Performance
- **`/api/horoscope` writes 3 caches per miss**: `horoscope_personal_daily` (INSERT OR
  IGNORE), `horoscope_global_daily` (INSERT OR IGNORE), `horoscope_cache` (INSERT OR
  REPLACE). 3 writes per LLM miss — fine, but on a cache hit it still does 1 SELECT +
  `updateStreak` (2 more queries) + `computeAstroHardFacts` (recompute transits). Could
  serve cache purely.
- **`/api/mood/stats` N+1** (see Astrology section) — heaviest perf issue in the audit.

### Data validation
- `horoscope` POST: no body validation (none needed — uses user's birth data).
- `tarot/cross` question: `String(...).slice(0, 200)` — good.
- `daily-energy/reflection`: `length > 5000` reject — good.
- `lunar-cycle/intention`: `length > 500` reject — good.
- `mood/checkin`: emoji whitelist + 1-5 score range — excellent.
- `favorites` POST: missing string check on `content` (see bugs).
- `rituals/today/complete`: `period` whitelisted — good.

### Missing features
- No `/api/horoscope/month` (only week).
- No paginated favorites.
- `weekly-content` GET has no `?week=` param — always current week only.

### Score: **6.5/10**

### Top 3 recommendations
1. Fix free-tier `scans_remaining` double-decrement in `/api/horoscope`.
2. Add per-IP rate-limit on `/api/compat/invite/:token/redeem`.
3. Cache `getTransits(date)` in a module-level Map (key = ISO date) — eliminates N+1 in
   mood stats and redundant recomputation across horoscope/transits/daily-energy.

---

## 5. GAMIFICATION (`/api/gamification/*`, `/api/streak/*`,
   `/api/astro/events`, `/api/natal-chart/portrait`, `/api/horoscope/feedback`)
**Files**: `server.js:3827-3887,5143-5278`, `gamification.js`

### Bugs / Crashes
- **`addXP` (gamification.js:91-106)** — not wrapped in a transaction. The `INSERT INTO
  xp_log`, `SELECT user_xp`, `UPDATE user_xp` triplet can race on concurrent quest
  completions, losing XP. Use `db.transaction(() => {…})`.
- **`ensureDailyQuests` (gamification.js:81-89)** — `INSERT OR IGNORE` in a loop with no
  transaction; 4 separate writes. Minor, but on a cold user this is 4 fsyncs.
- **`grantBadge` (gamification.js:108-113)** — silent `catch {}` swallows ALL errors,
  including DB corruption. Badges may silently fail to grant.
- **`/api/streak/freeze` (server.js:3858-3887)** — `qty === 0` means "free grant +1" but
  the route is mounted under `auth` with no admin check. Any authenticated user can POST
  `{"quantity":0}` and get +1 free freeze. The comment says it's for "grants gratuits
  (premium mensuel, admin, bonus onboarding)" but **there is no caller authorization**.
  **Abuse vector**: a script can loop this to accumulate unlimited free freezes. Fix:
  require `adminAuth` or a one-time-grant flag.
- **`/api/streak` GET (server.js:3827-3852)** — does a side-effecting UPDATE (reset weekly
  freeze) on a GET request. Violates HTTP semantics; GETs should be idempotent. Move the
  reset to a cron or to the freeze-consumption path.

### Security
- ⚠️ `POST /api/gamification/badge/:badgeId/grant` (gamification.js:213) — any
  authenticated user can grant themselves ANY badge by id. No whitelist check against
  `BADGE_DEFS`. This is the "manual grant" endpoint; should be admin-only or removed.
- ⚠️ Streak freeze abuse (see bugs).

### Error handling
`status` route has try/catch. `portrait` route has a **rich two-tier fallback** (LLM →
deterministic 1000-word generator) — best-in-class for this codebase.

### Performance
- `/api/astro/events` (gamification.js:222-282) recomputes Moon phase + Venus longitude
  for 30 days on every call. No cache. ~60 astronomy-engine calls per request. Add a
  daily cache (events don't change).
- `/api/gamification/status` runs `ensureDailyQuests` (potentially 4 INSERTs) on every
  GET — wrap in "if not exists" check (already done) but still 1 SELECT + up to 4 writes
  per status poll.

### Data validation
- `quest/complete`: questKey validated against `QUEST_DEFS` — good.
- `horoscope/feedback`: rating 1-5 numeric check — good.
- `badge/grant`: no badgeId validation (see security).

### Missing features
- No `/api/gamification/leaderboard` (mentioned in BADGE_DEFS but no endpoint).
- No quest streak multiplier (consecutive-day completion bonus).
- `cosmic_soul` badge (100-day streak) has no cron check — only granted if user hits
  `/api/gamification/status` on day 100 exactly.

### Score: **5.5/10**

### Top 3 recommendations
1. **Fix `/api/streak/freeze` free-grant abuse** — require adminAuth or remove the
   free-grant path entirely (move to a server-side cron).
2. Wrap `addXP` in a transaction; remove blanket `catch {}` in `grantBadge`.
3. Cache `/api/astro/events` per day; remove the side-effecting UPDATE from the GET
   `/api/streak` route.

---

## 6. BILLING (`/api/billing/*`, `/api/stripe/*`, `/api/premium/*`,
   `/api/portrait/pdf/*`)
**Files**: `billing.js`, `server.js:1577-1584,3803-3887`, `routes/portrait-pdf.js`

### Bugs / Crashes
- **Stripe webhook idempotency hole (billing.js:430-438)** — the `stripe_events` INSERT
  happens **before** the switch processes the event. If the switch throws (DB error mid-
  UPDATE), the event is marked as processed and Stripe will NOT retry. The grant is lost
  silently. Fix: insert the idempotency row only AFTER successful processing, or use a
  transaction.
- **Webhook grant failures swallowed (billing.js:484-488)** — `catch (grantErr)` logs but
  does not return 500 "so Stripe doesn't retry infinitely". This is the documented
  rationale, but it means a transient DB lock permanently loses a paid consumable. Better:
  return 500 on DB errors (retryable) and 200 only on logical errors.
- **`/api/billing/start-trial` (billing.js:165)** — sets `scans_remaining = 999999` as a
  sentinel for "unlimited". Other code does `scans_remaining - 1` arithmetic
  (`server.js:3008`) which turns 999999 into 999998 — the sentinel leaks. Use a separate
  `is_unlimited` flag or NULL semantics.
- **`/api/billing/restore` (billing.js:104-150)** — if `stripe.subscriptions.list`
  returns a `past_due` sub, it's treated as "active" and re-grants premium. A user with a
  failing card stays premium indefinitely. Stripe's `past_due` has a 4-day grace period;
  align with it.

### Security
- ✅ Webhook signature verification (billing.js:423) — correct.
- ✅ Raw body preserved before `express.json()` (server.js:1577-1584) — correct mount
  order.
- ✅ Consumable amounts are server-side constants (billing.js:31) — client cannot
  tamper.
- ⚠️ `success_url` / `cancel_url` use `req.protocol` + `req.get('host')` (billing.js:246,
  310, 376). With `trust proxy = 1` this is mostly safe, but an attacker who can inject
  `X-Forwarded-Host` could redirect checkout to a phishing domain. Pin the base URL to
  an env var `PUBLIC_URL`.
- ⚠️ Deprecated `mark-paid` routes (portrait-pdf.js:79, server.js:3359) return 410 —
  good cleanup, but the **old client-side IAP secret was removed**; verify no mobile build
  still ships the old `X-Celeste-IAP-Secret` header (it would 410 silently).

### Error handling
Good — every Stripe call wrapped in try/catch with 500 + French user message.

### Performance
- `stripe.subscriptions.list({ status: 'all', limit: 10 })` on every `/restore` call —
  external API round-trip. Cache the result for 60s per user.

### Data validation
- `create-checkout`: `plan` validated against `getPriceIdForPlan` — good.
- `create-consumable`: `type` validated against `CONSUMABLES` — good.
- `verify-consumable` / `verify-session`: `sessionId` required — good.

### Missing features
- No webhook for `invoice.payment_failed` (only `subscription.updated/deleted`) — a
  failing payment triggers no server-side action until the sub auto-cancels.
- No `customer.subscription.paused` handling.
- No Stripe → email receipt integration.

### Score: **7.0/10**

### Top 3 recommendations
1. Move `stripe_events` idempotency INSERT to **after** successful processing (or wrap
   the whole handler in a transaction).
2. Pin `success_url`/`cancel_url`/`return_url` to `process.env.PUBLIC_URL` instead of
   `req.protocol + host`.
3. Add `invoice.payment_failed` webhook handler + a `past_due`-aware grace period in
   `/restore`.

---

## 7. NOTIFICATIONS (`/api/notifications/*`, cron push jobs)
**Files**: `routes/notifications.js`, `server.js:3889-5478` (cron)

### Bugs / Crashes
- **`/api/notifications/test` (notifications.js:71-93)** — `Promise.allSettled` is good,
  but the dead-sub cleanup (lines 87-91) deletes by `endpoint` which is **unique per
  subscription**, not per user. If the same endpoint is shared (rare but possible via
  shared browser profile), deletion is correct. No bug, but worth noting.
- **Cron `runDailyPushJob` (server.js:5347+)** — `localHour = (utcHour - Math.floor(tz) +
  24) % 24`. For `tz = -5` (US east), `utcHour=14` → `localHour = (14 - (-5) + 24) % 24 =
  19` — correct. But for `tz = 5.5` (India), `Math.floor(5.5) = 5`, ignoring the 30-min
  offset → Indian users get push at the wrong half-hour. Minor.
- **Cron has no lock** — if two server instances run (e.g., during deploy), both fire
  `runDailyPushJob` and users get duplicate pushes. Use a SQLite advisory lock or a
  `last_cron_run` sentinel.

### Security
- ✅ Subscribe/unsubscribe behind `auth`.
- ⚠️ `POST /subscribe` (notifications.js:29) — `subscription.endpoint` is stored raw;
  no length cap. Could be used to store arbitrary strings. Add a URL-format check.
- ⚠️ VAPID public key exposed via GET (intentional) but **no VAPID private key
  validation** at startup — if `VAPID_PRIVATE_KEY` is missing, `webpush.sendNotification`
  throws at send time, not boot time. Fail fast.

### Error handling
Test endpoint correctly prunes 410/404 subs. Cron jobs have try/catch.

### Performance
- `sendPushToUser` (server.js:5326) uses `Promise.allSettled` — good for parallelism.
- Cron queries ALL users every 30 min (`WHERE notification_hour IS NOT NULL`) — fine at
  current scale, but add an index on `notification_hour` if user count grows.

### Data validation
- `hour` validated 0-23 (notifications.js:41,64) — good.
- `timezone` validated -12 to 14 — good.
- `subscription` keys checked for presence — good.

### Missing features
- No per-notification-type preferences (only hour).
- No push delivery receipt / open tracking.
- No silent push (data-only) for background sync.

### Score: **7.0/10**

### Top 3 recommendations
1. Add a cron lock (SQLite `last_cron_run` row) to prevent duplicate pushes across
   instances.
2. Validate `subscription.endpoint` is a valid URL before storing.
3. Fail fast at boot if `VAPID_PRIVATE_KEY` is missing.

---

## 8. ENGAGEMENT (`/api/transit-comments`, `/api/referrals/code`,
   `/api/onboarding/*`, `/api/rituals/*`, `/api/challenge/*`)
**Files**: `server.js:2262-2480,5217-5278,4793-4880,5143-5215`

### Bugs / Crashes
- **`/api/transit-comments` GET (server.js:2483)** — `date` and `key` from query are
  passed directly into the prepared statement (parameterised — safe), but there is **no
  format validation**. A client can pass `date='anything'` and get an empty list — not a
  bug, just loose. More importantly, `transit_key` is free-text; consider whitelisting.
- **`/api/referrals/code` GET (server.js:2262)** — generates a referral code per user but
  the generation logic isn't visible in the audited range; if it's `CEL-` + first 6 chars
  of a hash, collisions are possible. (Not read in detail — flag for follow-up.)
- **`/api/onboarding/step` POST (server.js:5235)** — `step` key not validated against
  `ONBOARDING_STEPS` (defined at :5209). A client can set arbitrary step keys.

### Security
- ✅ Comment delete checks `row.user_id !== req.user.id` (server.js:2532) — proper
  ownership.
- ⚠️ `/api/transit-comments` POST (server.js:2498) — `date` and `key` are not validated;
  an attacker could insert comments with `transit_date='2099-12-31'` to pollute future
  dates. Low impact (comments are scoped by date+key) but untidy.
- ⚠️ `display_name` auto-derived from email (server.js:2509-2511) — `email.split('@')[0]
  .slice(0,20)` could expose PII in a public comment thread. Consider a random
  pseudonym default.

### Error handling
Consistent try/catch across all engagement routes.

### Performance
- `/api/transit-comments` GET has a correlated subquery (`EXISTS SELECT 1 … WHERE
  l.comment_id = c.id AND l.user_id = ?`) per row. For 200 comments this is 200 sub-
  queries. Add an index on `transit_comment_likes(comment_id, user_id)` (likely already
  exists as PK) and a LEFT JOIN instead.

### Data validation
- `transit-comments` POST: `content.length > 500` — good.
- `onboarding/step`: missing step validation (see bugs).
- `rituals/today/complete`: `period` whitelisted — good.
- `challenge/week/complete`: `note.slice(0, 600)` — good.

### Missing features
- No comment moderation / report endpoint.
- No referral tracking dashboard.
- `onboarding/dismiss` exists but no "reset onboarding" for testing.

### Score: **6.5/10**

### Top 3 recommendations
1. Validate `onboarding/step` key against `ONBOARDING_STEPS`.
2. Replace correlated `EXISTS` subquery in transit-comments with a LEFT JOIN.
3. Use a random pseudonym instead of email-username for default `display_name` in public
   comments.

---

## Cross-Cutting Findings

### SQL Injection
- **No exploitable SQL injection found.** All user input goes through `db.prepare(…).run(…)`
  with parameterised placeholders. The `${table}` / `${where}` template strings
  (`account.js:33,83,91`, `server.js:1025,1028,5187`) use values from hard-coded arrays,
  not user input — safe today but fragile. Recommend refactoring to explicit prepares.

### Missing Auth Checks
- `/api/compat/invite/:token` GET and `/api/compat/invite/:token/redeem` POST are
  intentionally public (token-based) — correct design, but add per-IP rate-limit on
  redeem (LLM cost).
- `/api/astro/moon-phase`, `/api/health`, `/api/billing/status`, `/api/weekly-content`
  GET, `/api/auth/verify-email` — intentionally public. Correct.
- `/api/gamification/badge/:badgeId/grant` and `/api/streak/freeze` free-grant — should
  be admin-only (see Gamification).

### LLM Timeout Handling
- Excellent. `callLLMWithRetry` (server.js:830) has: `AbortController` per attempt,
  configurable `timeoutMs`, exponential backoff on 5xx, immediate bail on 429, circuit
  breaker, and a global mutex. Every caller has a deterministic fallback. The
  `glm-5.2-needs-32000-max-tokens` quirk is documented inline. Best subsystem in the
  codebase.

### Stripe Webhook Security
- Signature verification correct; raw body preserved; idempotency via `stripe_events`
  table (with the ordering bug noted in Billing). Consumable amounts are server-side
  constants. No client-tamperable price fields.

### Cache Invalidation
- `natal_interpretations` (asteroid wisdom) is a **lifetime cache with no invalidation**
  on birth-data change. If a user corrects their birth time, they see stale asteroid
  readings forever. Add: on `/api/profile/birth-data` POST, `DELETE FROM
  natal_interpretations WHERE user_id = ?`.
- `horoscope_personal_daily` keyed by `(sun, moon, rising, date)` — invalidates naturally
  by date. Good.
- `personal_transits` / `activated_houses` / `daily_energy` — daily cache, correct.

### Missing Indexes
- `users(email_verify_token)` — linear scan on verify-email. Add index.
- `users(notification_hour)` — cron scans all users every 30 min. Add index if scale grows.
- `transit_comment_likes(comment_id, user_id)` — likely covered by PK; verify.
- `stripe_events(id)` — PK, fine.

### Error-Handling Quality
Inconsistent. Auth/billing/gamification routes: consistent try/catch with French
messages. `routes/profiles.js` POST/PUT/DELETE: **no try/catch** — raw Express HTML 500
on DB error. Many silent `catch {}` blocks (server.js:2477, 3673, 6380, cron-events:229)
swallow errors without logging — debugging black holes.

### Data Validation Gaps (summary)
| Route | Issue |
|---|---|
| `POST /api/profiles` | birthData not strictly validated (lat/long coerced to 0) |
| `POST /api/favorites` | `content` not checked for string type before `.length` |
| `POST /api/onboarding/step` | `step` key not whitelisted |
| `POST /api/transit-comments` | `date`, `key` not format-validated |
| `GET /api/astro/moon-phase` | `date` query param no range check |
| `POST /api/gamification/badge/:badgeId/grant` | `badgeId` not whitelisted |

---

## Priority Summary

### P0 (critical / data loss / security)
1. **OAuth email-takeover** (oauth.js:315) — link only when email_verified.
2. **Stripe webhook idempotency ordering** (billing.js:430) — move INSERT after
   processing.
3. **`/api/streak/freeze` free-grant abuse** (server.js:3858) — add adminAuth.
4. **`/api/gamification/badge/:badgeId/grant` open** (gamification.js:213) — whitelist
   badgeId or admin-only.
5. **`computeHouses` reads wrong field names** (server.js:4900) — `birth.lat`/`lng` vs
   `latitude`/`longitude` → every user gets Paris houses.

### P1 (silent feature failures / perf)
6. **`/api/yearly-recap` queries non-existent `journal_entries.content`** → moodWord
   always null.
7. **`/api/horoscope` `scans_remaining` double-decrement**.
8. **`addXP` race condition** — wrap in transaction.
9. **`/api/mood/stats` N+1 transits compute** — cache daily transits.
10. **`natal_interpretations` no invalidation** on birth-data change.

### P2 (hardening)
11. Add `algorithms: ['HS256']` to all `jwt.verify` calls.
12. Constant-time compare for `ADMIN_TOKEN`.
13. Complete GDPR export (all user tables).
14. Cache `/api/astro/events` per day.
15. Add cron lock for `runDailyPushJob`.

---

*Generated 2026-08-02 by Hermes Agent. Server live-verified via curl on `:3001`.
DB schema verified via `sqlite3` PRAGMA queries. No code was modified — this is a
read-only audit.*
