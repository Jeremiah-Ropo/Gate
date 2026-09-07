import { mockEvents } from "@/lib/mockEvents";
import type { CheckIn, CheckInDevice, GateEvent, GateTicket } from "@/types";

const STORAGE_KEY = "gate.preview.store";

interface PreviewStore {
  events: GateEvent[];
  ticketsByOwner: Record<string, GateTicket[]>;
  devicesByEvent: Record<string, CheckInDevice[]>;
  checkInsByTicket: Record<string, CheckIn[]>;
}

function seed(): PreviewStore {
  return {
    events: mockEvents.map((event) => ({ ...event, inventory: event.inventory ? { ...event.inventory } : null })),
    ticketsByOwner: {},
    devicesByEvent: {},
    checkInsByTicket: {},
  };
}

function load(): PreviewStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PreviewStore) : seed();
  } catch {
    return seed();
  }
}

let store: PreviewStore = load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort — preview mode still works in-memory for the rest of this tab's session
    // even if storage is unavailable (private browsing, quota, etc).
  }
}

export function getPreviewStore(): PreviewStore {
  return store;
}

export function savePreviewStore() {
  persist();
}

export function resetPreviewStore() {
  store = seed();
  persist();
}
