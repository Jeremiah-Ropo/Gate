# Ibukun · Platform · 6 minutes

Speak for about three and a half minutes. Stop. Let them ask. Do not read the Q&A section unless they ask.

Clock: owned 60s · cut 45s · least sure 90s · leftover for questions.

---

## Say this

I own Platform: accounts and roles, rate limits, the queue and its workers, deploy, logs, and health.

I do not own the ticket count. I do not own whether a door scan is valid. If Redis or BullMQ is down, a claim must still be decided by PostgreSQL. My job is the shared runtime those slices run on.

What landed: attendee registration and one-session JWTs. Redis rate limits, not in-process ones. An API process and a worker process from the same build. Live and ready health checks. CI. A Render blueprint that is not the live demo if it is not deployed yet — say that if asked, do not hide it.

The ADR is 0003. Background work is a separate worker. We schedule delayed expiry jobs, and we also sweep PostgreSQL for overdue reservations. Both call Inventory's expire. The worker never writes capacity rules.

I rejected four things.

Workers inside the API: every extra API replica becomes another consumer, and a restart stops expiry.

Queue the claim itself: checkout waits on Redis, and a queue outage stops sales while the database is still correct.

Delayed jobs with no sweep: a missed enqueue holds a seat forever.

Sweep only: we already have BullMQ, and recovery gets slower for no gain.

What I cut, on purpose.

No email, SMS, or push. The brief forbids it. I removed the notification worker so we would not ship a forbidden feature by habit.

No chart dashboard. Operability is logs, health, and the runbook, not graphs.

No Kubernetes. One API, one worker, managed Postgres and Redis.

No general permission engine. Three roles: attendee, staff, admin. Event membership is Check-in's, not mine.

No email verification. `isVerified` means the account can be used, not that we proved the mailbox.

The decision I am least sure about is Redis failing closed on rate limits.

`passOnStoreError` defaults to false. If Redis is down, limited routes fail instead of going unlimited. That protects login and claim from a stampede. It also means a cache outage can stop a sale that PostgreSQL would have accepted.

I did not measure the limits. Login 10 a minute, claim 5, browse 120, door sync 300. Those are starting numbers, not load evidence.

If I had another week I would split the policy: fail closed on login, fail open on browse, and keep claim limited only when Redis is actually reachable — without letting the limiter become a second capacity check.

That is what I owned, what I cut, and the one I would still argue with myself about.

---

## If they ask

**Why not queue the claim?**
Claim latency would include queue delay. Redis down would stop sales. The count lives in Postgres. Queue after commit, never instead of the write.

**Why a sweep and a delayed job?**
The job is the timely path. The sweep is for a missed enqueue or a dead worker. Both call the same Inventory expire. Duplicate delivery is expected. The domain function must be idempotent.

**Does the worker own inventory?**
No. It passes a reservation id. Inventory does the conditional update. An empty worker registry is not done.

**Why a database lookup on every authenticated request?**
So logout and password change kill the session immediately, and so a role change is current. Access tokens are 15 minutes. We store a hash of the refresh token, not the token. Cost: one Postgres read per protected call. Alternative was a Redis blacklist. I kept it in the user row we already have.

**Why one session per account?**
A new login replaces the old one. Two phones cannot stay signed in. Simpler revoke. Worse for a user with a phone and a laptop. I would not defend that as a product win. I would defend it as three-week revoke.

**Why no email verification?**
Notifications are forbidden. A verify-email feature needs email. The account is usable after register.

**What happens if Redis dies?**
Rate limits fail closed. Cache misses fall back to Postgres on the read path — that is Events, not me. BullMQ stops; the sweep still expires holds once the worker can see Postgres. Claims should still be correct. They may be rejected 429/503 by my limiter. That is the uncomfortable part.

**Are you deployed?**
CI is on main. Render blueprint is #23. If it is not live, say: the contract is written, the services are named, we have not run the production URL in this room. Do not claim a deploy you cannot open.

**Where did you use AI?**
Design structure, ADR wording, this card. I checked the worker split, the limiter fail mode, and the session digest by hand against the code.

**What did not work?**
In-process workers and a notification leftover. Account work had to follow Inventory's schema change. Frontend refresh on Jeremiah's #37 still does not call our refresh endpoint — 15-minute access tokens will look logged in and then 401.

**Your bug report?**
Inventory, PR #31. `null` provider status is treated as failed. A GET during an in-flight pay can release the hold while the stub later records success. Charge, no ticket. I asked for that overlap test before merge. It is not there.

---

## Ask them this — live

One question, then the proposal. Do not stack two questions. If they dodge, ask the follow-up.

### Awe / Dipepo — Inventory

**Ask:** After `startPayment` commits, `pay()` has not written the stub row yet. A GET reconciles, sees `null`, and fails the payment. Why is “row not found” a terminal failure instead of “not ready to decide”?

**If they say the 60s TTL saves it:** TTL is on the sweep. `getById` reconciles immediately. Walk me through that GET.

**Proposal:** Keep `null` as processing. Fail only on explicit `failed`, or after a deadline that starts once the provider row exists. Add the overlap test from #31.

**Backup:** Two clients hit capacity 1 at the same instant. What single row serializes them, and what happens to the loser — 409, or a reserved count that went to 2?

### Victor — Events and console

**Ask:** You cache the name and venue, and you read remaining live. If the invalidation job is dropped, browse can show the old title for 15 minutes. Why is a stale name acceptable when a stale count is not?

**Follow-up:** Publish creates the inventory row inside your transaction. Why is that Events writing Inventory, not an Inventory method Events is allowed to call?

**Proposal:** Keep the live count. Make a dropped invalidation job fail the worker so it retries, and do not treat TTL as the freshness mechanism — you already said that in ADR 0004.

### Jeremiah — Public browse

**Ask:** If Events already owns the projection and the cache, what failure do _you_ own? If `eventProjectionService` is wrong, what in this slice notices?

**Follow-up:** The frontend stores a refresh token and never calls `POST /auth/refresh-token`. After 15 minutes the UI looks logged in and every claim 401s. Is that yours or mine?

**Proposal:** Keep one projection. Add a contract test that browse 404s drafts and never returns `reserved`/`sold`. Fix refresh-and-retry on #37 before we call browse done.

### Timi — Check-in

**Ask:** Two online doors can admit the same ticket two seconds apart because each decides locally. The unique index catches it later. What does the second person in the room see, and what does the organiser see, in that window?

**Follow-up:** You dropped partitions because general admission has no door assignment. If the room says “double admit is worse than a wrong queue,” what would you put back, and what product rule would it force at the gate?

**Proposal:** Keep detect-on-sync. Show conflicts in the organiser console in this demo, or say out loud that a conflict nobody can see is not detected.

---

## Do not say

- "We cannot oversell" as if you proved it. That is Awe's invariant. You provided the worker that calls expire.
- "Redis is just a cache." You use it for limits and the queue.
- "LGTM." If they ask about reviews: you left a question and a rewrite on #31 and #35 and #37.
- Limit numbers as if they came from a load test.
