import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ErrorState } from "@/components/StatusMessage";
import { useAuth } from "@/context/AuthContext";
import { errorMessage, login } from "@/lib/api";
import { createPreviewSession, roleHome } from "@/lib/previewSession";
import { resetPreviewStore } from "@/lib/previewStore";
import type { UserRole } from "@/types";

const PREVIEW_ROLES: { role: UserRole; label: string; description: string }[] = [
  { role: "attendee", label: "Attendee", description: "Browse, claim tickets, view \"My tickets\"" },
  { role: "staff", label: "Staff", description: "Door check-in: look up/void tickets, manage scanners" },
  { role: "admin", label: "Admin", description: "Create events, allocate capacity, publish/cancel" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      setSession(session);
      navigate(next);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ email, password });
  };

  const handlePreview = (role: UserRole) => {
    setSession(createPreviewSession(role), true);
    navigate(next !== "/" ? next : roleHome(role));
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="text-xl font-semibold text-neutral-900">Log in</h1>
      <p className="mt-1 text-sm text-neutral-500">Welcome back — pick up where you left off.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        New here?{" "}
        <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-medium text-neutral-900">
          Create an account
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-300 p-4">
          <p className="text-sm font-medium text-neutral-900">Preview mode</p>
          <p className="mt-1 text-xs text-neutral-500">
            Staff and admin accounts aren't self-registered — Gate's API has no signup field for
            role, so real ones are provisioned directly. Use these to see each role's UI without
            a backend at all; the data is fake and lives only in this browser.
          </p>
          <div className="mt-3 space-y-2">
            {PREVIEW_ROLES.map(({ role, label, description }) => (
              <button
                key={role}
                type="button"
                onClick={() => handlePreview(role)}
                className="flex w-full flex-col items-start rounded-md border border-neutral-200 px-3 py-2 text-left hover:bg-neutral-50"
              >
                <span className="text-sm font-medium text-neutral-900">Preview as {label}</span>
                <span className="text-xs text-neutral-500">{description}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              resetPreviewStore();
              window.location.reload();
            }}
            className="mt-3 text-xs font-medium text-neutral-400 hover:text-neutral-600"
          >
            Reset preview data
          </button>
        </div>
      )}
    </div>
  );
}
