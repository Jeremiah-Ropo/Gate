/**
 * Public surface of the Events slice.
 *
 * Other slices depend on this barrel, not on files inside the module: the Public browse slice
 * consumes the published-event projection from here and serves it over its own anonymous HTTP
 * endpoints. Anything not re-exported below is internal and may change without notice.
 *
 * The projection includes the event-owned fields required by both the organiser console and public
 * browse. Inventory counters remain live and are merged by the projection service.
 */
export { default as eventProjectionService } from "./service/event-projection.service";
export type {
  IConsoleEventRow,
  IEventProjectionService,
  IPublishedEventDescriptor,
  IPublishedEventProjection,
} from "./entity/event.interface";
