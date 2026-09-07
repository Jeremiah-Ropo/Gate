import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

// Gates a route to signed-in users whose role is in `roles`. Signed-out visitors are sent to
// login (remembering where they were headed); signed-in users with the wrong role are sent
// home rather than shown a 403 — there's nothing for e.g. an attendee to do on /admin/events.
export function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
