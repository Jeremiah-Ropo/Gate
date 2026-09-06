# Gate Frontend — Public Browse

The Public Browse slice's surface: anyone can browse published events with no account,
and hits a register/login wall only at the point of claiming a ticket. Pairs with the
`Gate` backend repo (sibling folder) over its `/v1` API.

## Pages

- `/` — published events, no auth
- `/events/:eventId` — event detail, no auth. "Get ticket" routes to `/register` if the
  visitor isn't signed in, carrying `?next=` back to this page
- `/register`, `/verify`, `/login` — the account wall, per brief item 2
- Claiming a ticket (`POST /ticket`) only fires once the visitor holds a session

## Run it

```bash
cp .env.example .env   # point VITE_API_URL at your Gate backend
yarn install
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

## Known dependency gap (not this slice)

Registration requires an emailed verification code (`POST /auth/register` →
`POST /auth/verify-email`), but this environment has no real email delivery wired up —
that's Platform/Auth territory, not Public Browse's. The verify page says so plainly
rather than faking it. Until that's in place, completing registration end-to-end needs
whoever owns Auth to either configure a mail provider or add a dev-mode way to read the
code.
