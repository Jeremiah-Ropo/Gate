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
    <header className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link to="/" className="text-3xl font-bold tracking-tighter text-neutral-900">
          Gate
        </Link>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <Link to="/" className="font-medium text-neutral-700">
            Explore
          </Link>
          {isAuthenticated ? (
            <>
              {user?.role === "attendee" && (
                <Link to="/tickets" className="font-medium text-neutral-700 hover:text-neutral-900">
                  My tickets
                </Link>
              )}
              {user?.role === "staff" && (
                <Link to="/door" className="font-medium text-neutral-700 hover:text-neutral-900">
                  Door check-in
                </Link>
              )}
              {user?.role === "admin" && (
                <>
                  <Link to="/admin/events" className="font-medium text-neutral-700 hover:text-neutral-900">
                    Manage events
                  </Link>
                  <Link to="/admin/platform" className="font-medium text-neutral-700 hover:text-neutral-900">
                    Platform demo
                  </Link>
                  <Link to="/door" className="font-medium text-neutral-700 hover:text-neutral-900">
                    Door check-in
                  </Link>
                </>
              )}
              <span className="hidden text-neutral-600 sm:inline">Hi, {user?.firstName}</span>
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
