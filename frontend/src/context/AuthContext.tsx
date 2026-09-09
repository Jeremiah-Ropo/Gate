import { createContext, useContext, useState, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";
import { setAuthToken } from "@/lib/api";
import type { AuthSession, GateUser } from "@/types";

const STORAGE_KEY = "gate.session.v2";
interface AuthContextValue {
  user: GateUser | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSession) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const session = raw ? JSON.parse(raw) as AuthSession : null;
    setAuthToken(session?.token ?? null);
    return session;
  } catch { return null; }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(readStoredSession);
  const setSession = (next: AuthSession) => {
    queryClient.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuthToken(next.token);
    setSessionState(next);
  };
  const logout = () => {
    queryClient.clear();
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setSessionState(null);
  };
  return <AuthContext.Provider value={{ user: session?.user ?? null, isAuthenticated: session !== null, setSession, logout }}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
