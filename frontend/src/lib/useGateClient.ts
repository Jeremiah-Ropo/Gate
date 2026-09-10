import * as api from "@/lib/api";

export type GateClient = typeof api;

// There is one client: the real backend. API outages must not turn into fake success.
export function useGateClient(): GateClient {
  return api;
}
