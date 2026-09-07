import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { setAuthToken } from "@/lib/api";
import type { AuthSession, GateUser } from "@/types";

const STORAGE_KEY = "gate.session";

// A preview session (see lib/previewSession) is a locally-fabricated GateUser used to explore
// role-specific UI without a running backend — isPreview tells the rest of the app to route
// data calls through the in-browser preview store (lib/useGateClient) instead of the network.
interface StoredSession extends AuthSession {
  isPreview?: boolean;
}

interface AuthContextValue {
  user: GateUser | null;
  isAuthenticated: boolean;
  isPreview: boolean;
  setSession: (session: AuthSession, isPreview?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StoredSession | null>(() => readStoredSession());

  // api.ts keeps the bearer token as module state (see its comment) rather than taking it
  // per-call, so every session change has to be mirrored into it here. A preview token is
  // never sent anywhere — useGateClient routes preview sessions away from api.ts entirely —
  // but clearing it on logout/preview-switch still matters so a stale real token can't leak.
  useEffect(() => {
    setAuthToken(session && !session.isPreview ? session.token : null);
  }, [session]);

  const setSession = (next: AuthSession, isPreview = false) => {
    const stored: StoredSession = { ...next, isPreview };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setSessionState(stored);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionState(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isPreview: session?.isPreview ?? false,
      setSession,
      logout,
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- co-locating the hook with its provider is intentional
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
