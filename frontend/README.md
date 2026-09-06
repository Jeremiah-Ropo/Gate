# Gate Frontend — Public Browse

The Public Browse slice's surface: anyone can browse published events with no account,
and hits a register/login wall only at the point of claiming a ticket. Pairs with the
Gate backend in the repository root over its `/v1` API.

This directory was imported from `Jeremiah-Ropo/Gate-Frontend` with its Git history.
Run frontend commands from this directory; the backend retains its own package and lockfile.

## Pages

- `/` — published events, no auth
- `/events/:eventId` — event detail, no auth. "Get ticket" routes to `/register` if the
  visitor isn't signed in, carrying `?next=` back to this page
- `/register`, `/verify`, `/login` — the account wall, per brief item 2
- Claiming a ticket (`POST /ticket`) only fires once the visitor holds a session

## Run it

```bash
cd frontend           # from the Gate repository root
cp .env.example .env   # point VITE_API_URL at your Gate backend
yarn install --frozen-lockfile
yarn dev                # http://localhost:3000
```

The Gate backend must be running (see its own README) with `GET /event` and
`GET /event/:id` reachable without a token.

## Decisions made in this slice

- **Caching**: `@tanstack/react-query` with a 30s `staleTime` on event reads
  (`src/lib/queryClient.ts`) — events change on an organiser's schedule, not every
  request, and ticket claims are a mutation, never cached.
- **Public-only listing**: the backend's `GET /event` returns events in every lifecycle
  status; `BrowseEventsPage` filters to `published` client-side so a draft or cancelled
  event never surfaces to an anonymous visitor.
- **Session storage**: JWT + refresh token + user kept in `localStorage` via
  `AuthContext`, mirrored into the API client's in-memory bearer token on every change.

## Integration work remaining

The imported frontend still contains the email-verification flow. The agreed backend
account flow registers and signs in directly, so the frontend owner must reconcile
that flow with Platform PR #9. Public event visibility must also be enforced by the
backend; browser filtering is not access control. Preview/mock behavior and session
storage need review before declaring live API integration complete.

The import preserves the application behavior. A successful static build alone does
not establish that registration, ticket claims, or check-in work against the backend.
