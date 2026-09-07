import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="font-serif text-xl font-semibold tracking-tight text-neutral-900">
          Gate
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {isAuthenticated ? (
            <>
              {user?.role === "attendee" && (
                <Link to="/tickets" className="font-medium text-neutral-700 hover:text-neutral-900">
                  My tickets
                </Link>
              )}
              {user?.role === "staff" && (
                <Link to="/staff/check-in" className="font-medium text-neutral-700 hover:text-neutral-900">
                  Door check-in
                </Link>
              )}
              {user?.role === "admin" && (
                <>
                  <Link to="/admin/events" className="font-medium text-neutral-700 hover:text-neutral-900">
                    Manage events
                  </Link>
                  <Link to="/staff/check-in" className="font-medium text-neutral-700 hover:text-neutral-900">
                    Door check-in
                  </Link>
                </>
              )}
              <span className="text-neutral-600">Hi, {user?.firstName}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="font-medium text-neutral-700 hover:text-neutral-900">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
