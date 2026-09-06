import { QueryClient } from "@tanstack/react-query";

// Public browse owns this slice's caching decision: event listings change on an organiser's
// schedule, not every second, so a 30s staleTime avoids refetching on every tab focus while
// still catching a newly published event within a demo-reasonable window. Ticket claims are
// never cached — they're a write, handled as a mutation instead.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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
  checkInDevices: (eventId: string) => ["check-in-devices", eventId] as const,
  checkInsForTicket: (ticketId: string) => ["check-ins", ticketId] as const,
};
