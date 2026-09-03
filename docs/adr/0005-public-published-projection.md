# ADR 0005: Expose a dedicated anonymous published-event projection

- Status: Proposed
- Owner: Jeremiah, Public browse
- Date: 3 September 2026

## Context

The brief requires browsing without an account and claiming with one. Reusing authenticated organizer endpoints can accidentally require login or expose draft/private fields.

## Decision

Expose dedicated anonymous list/detail routes that return only the versioned published-event projection. Apply cursor pagination, bounded page size, and public rate limits. A claim action crosses an explicit authentication boundary and returns the user to the chosen event after login.

## Alternatives rejected

- Require an account for all event reads: violates the stated requirement.
- Reuse organizer endpoints with optional authentication: increases the risk of exposing draft/private data and produces ambiguous authorization behavior.
- Render data directly from Redis in the browser: bypasses server validation/projection and exposes cache topology.

## Consequences

The public surface has a stable minimal contract separate from organizer data. Some mapping code is duplicated intentionally at the boundary. Public availability is not a promise; the claim endpoint returns the authoritative result. Browser caches store no privileged data.

## Proof

Test anonymous success, draft/cancelled exclusion, bounded pagination, cache-equivalent responses, `401` on claim without authentication, and rate-limit responses.

## AI disclosure

AI helped structure this draft. The owner must validate the public fields, authentication boundary, pagination, and failure behavior.
