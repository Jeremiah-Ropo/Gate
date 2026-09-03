# ADR 0001: Use one TypeScript web stack and a modular monolith

- Status: Proposed
- Owners: Gate team
- Date: 3 September 2026

## Context

Five engineers have to deliver one deployed system. The capstone requires the team to choose one backend language/framework on day 1, choose one web stack, automate formatting/linting, and record the choice as the first ADR. The existing repository already contains an Express/TypeScript backend, Drizzle/PostgreSQL, Redis, BullMQ, Pino, ESLint, Prettier, and Mocha tests.

The door must run in a phone browser and continue offline. There is no native app. The team has insufficient time to learn a second backend language or introduce multiple independently deployed business services.

## Decision

- Use TypeScript and Express for the backend.
- Keep one modular monolith repository with domain modules and shared infrastructure.
- Use PostgreSQL through Drizzle as the durable store.
- Use Redis for public cache, distributed traffic controls, and BullMQ delivery, never as the authoritative ticket count.
- Run the API and worker as separate deployable processes from the same codebase.
- Use TypeScript, React, and Vite for the web surfaces, including the PWA door page. This frontend choice remains proposed until all five owners confirm it.
- Enforce the repository's ESLint and Prettier configuration in CI.

## Alternatives rejected

### A second backend language or framework

Rejected because the repository is already implemented in TypeScript/Express and the brief says to select what most engineers can already read. A rewrite would consume the remaining week without improving the two assessed invariants: no overselling and offline check-in.

### Independent microservices for every slice

Rejected because five deployment units would add network failure, distributed tracing, versioning, and transaction-boundary work. Slice ownership is maintained through module and interface boundaries, not separate services.

### A native door application

Rejected explicitly by the brief. A web PWA supports the required phone surface and avoids a second build/distribution pipeline.

## Consequences

- All owners follow existing TypeScript, module, lint, and formatting conventions.
- Domain boundaries require review because the compiler cannot prevent every cross-module dependency.
- API and worker may scale independently while sharing types and domain services.
- PostgreSQL and Redis are operational dependencies that must appear in health checks and the runbook.
- The team must confirm React/Vite before changing this ADR to Accepted.

## Verification

- `yarn lint`, `yarn format-lint`, `yarn build`, and `yarn test` run in CI.
- API and worker build from the same commit and start independently.
- The PWA works in a phone browser and its offline behavior is demonstrated.

## AI disclosure

AI helped structure this draft and compare it with the repository. The team must verify the stack choice, alternatives, and consequences and be able to defend them.
