export const EVENT_CACHE_QUEUE = "event-cache-queue";
export const EVENT_CACHE_INVALIDATE = "event-cache-invalidate";

/** What committed mutation triggered the invalidation — carried for telemetry, not for branching. */
export type EventMutationReason = "published" | "updated";

/**
 * Invalidation job envelope.
 *
 * Fields follow the queue contract in the system guide: an operation name, a version so a handler
 * can reject a shape it does not understand, and a correlation id. `committedAt` doubles as the
 * dedupe discriminator in the job id, so republishing for the same commit collapses to one job.
 *
 * Platform owns the shared job envelope; this is the minimum that contract calls for and should be
 * folded into theirs once it exists rather than living here permanently.
 */
export interface IEventCacheInvalidateJob {
  operation: typeof EVENT_CACHE_INVALIDATE;
  version: 1;
  eventId: string;
  reason: EventMutationReason;
  correlationId: string;
  committedAt: string;
}
