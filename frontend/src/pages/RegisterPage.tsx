import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ErrorState } from "@/components/StatusMessage";
import { errorMessage, register } from "@/lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (result) => {
      const verifyParams = new URLSearchParams({
        sessionId: result.sessionId,
        resendTokenSessionId: result.resendTokenSessionId,
        next,
      });
      navigate(`/verify?${verifyParams.toString()}`);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ firstName, lastName, email, password });
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="text-xl font-semibold text-neutral-900">Create an account</h1>
      <p className="mt-1 text-sm text-neutral-500">You need one to claim a ticket. Browsing never requires this.</p>
      {import.meta.env.DEV && (
        <p className="mt-2 text-xs text-neutral-400">
          Registering only ever creates an attendee — there's no role field here on purpose.
          Want to see the staff or admin UI? Use{" "}
          <Link to="/login" className="underline">
            Preview mode on the login page
          </Link>
          .
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-400">At least 8 characters.</p>
        </div>

        {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-neutral-900">
          Log in
        </Link>
      </p>
    </div>
  );
}
