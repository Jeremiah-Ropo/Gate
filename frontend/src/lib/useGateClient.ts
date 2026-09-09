import * as api from "@/lib/api";
// There is one client: the real backend. API outages must not turn into fake success.
export function useGateClient() { return api; }
