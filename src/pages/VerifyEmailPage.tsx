import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ErrorState } from "@/components/StatusMessage";
import { useAuth } from "@/context/AuthContext";
import { errorMessage, resendVerification, verifyEmail } from "@/lib/api";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionId = searchParams.get("sessionId") ?? "";
  const resendTokenSessionId = searchParams.get("resendTokenSessionId") ?? "";
  const next = searchParams.get("next") ?? "/";

  const [code, setCode] = useState("");

  const verify = useMutation({
    mutationFn: verifyEmail,
    onSuccess: (session) => {
      setSession(session);
      navigate(next);
    },
  });

  const resend = useMutation({
    mutationFn: () => resendVerification(resendTokenSessionId),
    onSuccess: (result) => {
      const params = new URLSearchParams({ sessionId: result.sessionId, resendTokenSessionId: result.resendTokenSessionId, next });
      setSearchParams(params);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate({ sessionId, token: code });
  };

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-sm px-4 py-14">
        <ErrorState message="This verification link is missing its session — start over from Register." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="text-xl font-semibold text-neutral-900">Check your email</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Enter the 6-digit code we sent you to finish creating your account.
      </p>

      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Local/demo note: this environment doesn't have real email delivery wired up yet — that's
        owned outside the Public Browse slice. Ask whoever owns Platform/Auth for the code, or for
        a dev-mode way to see it.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="code">
            Verification code
          </label>
          <input
            id="code"
            required
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-[0.3em]"
            placeholder="······"
          />
        </div>

        {verify.isError && <ErrorState message={errorMessage(verify.error)} />}

        <button
          type="submit"
          disabled={verify.isPending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {verify.isPending ? "Verifying…" : "Verify and continue"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => resend.mutate()}
        disabled={resend.isPending || !resendTokenSessionId}
        className="mt-4 w-full text-center text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
      >
        {resend.isPending ? "Resending…" : "Resend code"}
      </button>
      {resend.isError && <div className="mt-2"><ErrorState message={errorMessage(resend.error)} /></div>}
      {resend.isSuccess && <p className="mt-2 text-center text-xs text-green-700">A new code was sent.</p>}
    </div>
  );
}
