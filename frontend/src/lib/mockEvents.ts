import type { GateEvent } from "@/types";

// Sample data shown only when the Gate API can't be reached (see BrowseEventsPage /
// EventDetailPage) — lets this slice's UI be reviewed without the backend running.
// Never returned by the API client itself; the real /event response always wins.
const OWNER_ID = "00000000-0000-0000-0000-000000000001";

function iso(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function inventory(eventId: string, capacity: number, reserved: number, sold: number) {
  return {
    eventId,
    capacity,
    reserved,
    sold,
    remaining: capacity - reserved - sold,
    createdAt: iso(-14, 9),
    updatedAt: iso(-1, 9),
  };
}

export const mockEvents: GateEvent[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    name: "Lagos Afrobeats Night",
    slug: "lagos-afrobeats-night",
    description:
      "A night of live Afrobeats sets from three headline acts, open-air on the Lekki waterfront. Doors open at 7, first act at 8.",
    venue: "Waterside Arena",
    address: "12 Kofo Abayomi Street, Victoria Island, Lagos",
    coverImage: "https://picsum.photos/seed/gate-afrobeats/800/450",
    startsAt: iso(18, 19),
    ticketPrice: 15000,
    currency: "NGN",
    status: "published",
    createdBy: OWNER_ID,
    createdAt: iso(-10, 9),
    updatedAt: iso(-2, 9),
    inventory: inventory("00000000-0000-0000-0000-000000000101", 500, 12, 260),
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    name: "Founders & Coffee: Building in Public",
    slug: "founders-and-coffee-building-in-public",
    description:
      "A small, informal morning meetup for early-stage founders. Bring your laptop, expect frank feedback and free coffee.",
    venue: "The Yard Coworking",
    address: "4 Admiralty Way, Lekki Phase 1, Lagos",
    coverImage: "https://picsum.photos/seed/gate-founders/800/450",
    startsAt: iso(9, 9),
    ticketPrice: 0,
    currency: "NGN",
    status: "published",
    createdBy: OWNER_ID,
    createdAt: iso(-14, 9),
    updatedAt: iso(-1, 9),
    inventory: inventory("00000000-0000-0000-0000-000000000102", 40, 3, 37),
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    name: "Gate Capstone Demo Day",
    slug: "gate-capstone-demo-day",
    description:
      "Five slices, one system. Fifteen minutes of team demo, then six minutes each on what shipped, what got cut, and the decision they're least sure about.",
    venue: "Sincere Fellowship HQ",
    address: "Remote + on-site",
    coverImage: "https://picsum.photos/seed/gate-democay/800/450",
    startsAt: iso(21, 14),
    ticketPrice: 0,
    currency: "NGN",
    status: "published",
    createdBy: OWNER_ID,
    createdAt: iso(-7, 9),
    updatedAt: iso(-1, 9),
    inventory: inventory("00000000-0000-0000-0000-000000000103", 120, 0, 45),
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    name: "Abuja Tech Mixer",
    slug: "abuja-tech-mixer",
    description: "Cross-company mixer for engineers, PMs and designers based in Abuja. Light food, no talks.",
    venue: "Continental Hotel Rooftop",
    address: "Central Business District, Abuja",
    coverImage: "https://picsum.photos/seed/gate-abuja-mixer/800/450",
    startsAt: iso(30, 18),
    ticketPrice: 5000,
    currency: "NGN",
    status: "published",
    createdBy: OWNER_ID,
    createdAt: iso(-5, 9),
    updatedAt: iso(-5, 9),
    inventory: inventory("00000000-0000-0000-0000-000000000104", 150, 0, 150),
  },
];
