# Platform account contract

- Registration creates an attendee directly using the merged `passwordHash` schema. `isVerified` means usable without an email-verification step; it is not proof of mailbox ownership.
- Registration no longer caches signed-in responses in Redis or requires an Idempotency-Key. The database unique email constraint prevents duplicate accounts; a retry after success returns 409 and the user can log in.
- Profile updates allow names only. The HTTP validator rejects other fields; the service separately selects allowed properties. All user responses use one explicit public view, never a database-record spread.
- Profile picture upload and phone fields are removed from this slice. Event cover-image upload belongs to Events and is unchanged.
- One session per account. A fresh login replaces the previous session. Access JWTs expire after the configured access lifetime (default 15 minutes); refresh JWTs expire after the configured refresh lifetime (default 7 days). Token kinds are not interchangeable.
- The existing `users.refreshToken` column stores a SHA-256 digest of the high-entropy signed refresh credential, not the bearer credential itself. Access JWTs bind to that session digest. No schema migration or Redis blacklist is needed.
- Protected requests verify the signature and expiry, then check the current session and role in PostgreSQL. Logout conditionally clears that session; an old logout cannot clear a newer login. Password change clears the current session. Both require logging in again after revocation.
- This deliberately trades one database lookup per protected request for immediate session revocation and current roles. Event-specific membership/ownership remains the domain owner's responsibility.
- Existing tokens are invalid after this change: log in again. There is no old-token fallback.
- Logout keeps the existing JSON `{ token }` request contract. Refresh uses `{ refreshToken }`; credentials must not appear in logs or user-profile JSON.

## Evidence and remaining work

`test/account-security.test.ts` exercises real Express routes, controllers, guards and services with an isolated repository. It does not claim a deployed or real-PostgreSQL end-to-end pass. Full repository compilation still depends on other slices reconciling Events, Ticket and Check-in callers with the merged schema.

Inventory must supply the conditional expiry handler before the Platform worker can process reservations. An empty worker registry is not completion evidence.
