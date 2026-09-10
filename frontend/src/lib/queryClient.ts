import { QueryClient } from "@tanstack/react-query";

// Public browse owns this slice's caching decision: listings change when an organiser
// publishes, not on a timer. A 5-minute staleTime keeps the catalogue stable; publish and
// update mutations invalidate `queryKeys.events` so a new event appears immediately.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  events: ["events"] as const,
  event: (id: string) => ["events", id] as const,
  myTickets: ["tickets", "mine"] as const,
  ticket: (id: string) => ["tickets", id] as const,
  myDoorEvents: ["door", "my-events"] as const,
  doorSession: (eventId: string) => ["door", "session", eventId] as const,
  checkInsForTicket: (ticketId: string) => ["check-ins", ticketId] as const,
};
