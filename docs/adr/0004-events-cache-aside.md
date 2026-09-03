# ADR 0004: Cache published event projections with cache-aside Redis

- Status: Proposed
- Owner: Victor, Events and console
- Date: 3 September 2026

## Context

Published event reads are public and read-heavy, while publication/update is comparatively rare. PostgreSQL is authoritative. Cached responses must never expose drafts or become the source of ticket-claim correctness.

## Decision

Define a versioned published-event projection. Read Redis first, fall back to PostgreSQL on miss, and populate with a bounded TTL. After a committed event publication/update/cancellation, invalidate the exact list/detail keys through the Platform job contract. The read-only organizer console reads authoritative operational data rather than trusting the public cache.

## Alternatives rejected

- No cache: simplest and acceptable initially, but does not demonstrate the assigned caching responsibility or reduce repeated public reads.
- Write-through cache: couples event writes to Redis availability and complicates transaction semantics.
- Cache complete event records: risks exposing unpublished/private fields and couples clients to internal schema.

## Consequences

Brief staleness is bounded by TTL, and explicit invalidation shortens it. Cache miss/hit must return the same public projection. Redis outage policy must be agreed and observed. Availability displayed to users is advisory; Inventory decides claim success in PostgreSQL.

## Proof

Test hit, miss, invalidation, expiry, Redis failure, and draft/cancelled exclusion. Log cache outcome and measure hit rate/read latency without building a chart dashboard.

## AI disclosure

AI helped structure this draft. The owner must validate projection fields, TTL, invalidation keys, failure policy, and measurements.
