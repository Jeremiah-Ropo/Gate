/**
 * Public surface of the Events slice.
 *
 * Other slices depend on this barrel, not on files inside the module: the Public browse slice
 * consumes the published-event projection from here and serves it over its own anonymous HTTP
 * endpoints. Anything not re-exported below is internal and may change without notice.
 *
 * Note for browse: coverImage is intentionally not in the projection. Say so at API contract
 * review if the browse surface needs it and it can be added to the descriptor.
 */
export { default as eventProjectionService } from "./service/event-projection.service";
export type {
  IConsoleEventRow,
  IEventProjectionService,
  IPublishedEventDescriptor,
  IPublishedEventProjection,
} from "./entity/event.interface";
