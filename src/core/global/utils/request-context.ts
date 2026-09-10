import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
  requestId: string;
  actorId?: string;
  actorRole?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function setRequestActor(actorId: string, actorRole: string): void {
  const context = storage.getStore();
  if (!context) return;
  context.actorId = actorId;
  context.actorRole = actorRole;
}
