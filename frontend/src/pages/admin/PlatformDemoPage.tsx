import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, type DemoSignal, errorMessage } from "@/lib/api";
import { useGateClient } from "@/lib/useGateClient";

const scenarios: Array<{ signal: DemoSignal; label: string; detail: string; expected: number }> = [
  { signal: "healthy", label: "Healthy request", detail: "Shows the normal API path and a 200 log.", expected: 200 },
  { signal: "unauthorized", label: "Missing login", detail: "Produces a safe 401 without exposing credentials.", expected: 401 },
  { signal: "forbidden", label: "Wrong role", detail: "Produces a 403 role-policy signal.", expected: 403 },
  { signal: "rate-limited", label: "Traffic spike", detail: "Produces one 429 signal without flooding the service.", expected: 429 },
  { signal: "dependency-down", label: "Dependency unavailable", detail: "Produces a controlled 503; no dependency is stopped.", expected: 503 },
];

export function PlatformDemoPage() {
  const client = useGateClient();
  const [result, setResult] = useState("Choose a condition to create a real, observable HTTP outcome.");
  const metrics = useQuery({ queryKey: ["platform-metrics"], queryFn: client.getPlatformMetrics, refetchInterval: 5000 });
  const simulation = useMutation({
    mutationFn: async ({ signal, expected }: { signal: DemoSignal; expected: number }) => {
      try {
        await client.emitDemoSignal(signal);
        return expected;
      } catch (error) {
        if (error instanceof ApiError && error.status === expected) return expected;
        throw error;
      }
    },
    onSuccess: (status) => {
      setResult(`Observed HTTP ${status}. Metrics refresh automatically; the structured request appears in Render logs.`);
      void metrics.refetch();
    },
    onError: (error) => setResult(errorMessage(error)),
  });

  const snapshot = metrics.data;
  const queueTotals = snapshot
    ? Object.values(snapshot.queues).reduce(
        (total, queue) => ({ waiting: total.waiting + queue.waiting, failed: total.failed + queue.failed }),
        { waiting: 0, failed: 0 },
      )
    : null;

  return (
    <div className="page-shell">
      <p className="eyebrow">Admin / Platform</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold text-neutral-900">Demo control room</h1>
          <p className="mt-2 text-neutral-600">Safe signals for explaining health, logs, metrics, rate limits and failure handling.</p>
        </div>
        <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium" onClick={() => void metrics.refetch()}>
          Refresh metrics
        </button>
      </div>

      <section aria-labelledby="metrics-title" className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 id="metrics-title" className="text-xl font-semibold">Live application metrics</h2>
          <span className="text-xs text-neutral-500">Refreshes every 5 seconds</span>
        </div>
        {metrics.isError && <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorMessage(metrics.error)}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["HTTP requests", snapshot?.http.requests ?? "..."],
            ["Server errors", snapshot?.http.errors ?? "..."],
            ["Queue waiting", queueTotals?.waiting ?? "..."],
            ["Worker jobs failed", snapshot?.worker.jobsFailed ?? "..."],
          ].map(([label, value]) => (
            <div key={label} className="booking-panel"><p className="eyebrow">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
          <strong className="text-neutral-900">Worker heartbeat:</strong>{" "}
          {snapshot?.worker.heartbeatAt ? new Date(snapshot.worker.heartbeatAt).toLocaleString() : "Not observed yet"}
          <span className="mx-3 text-neutral-300">|</span>
          <strong className="text-neutral-900">Overdue reservations:</strong> {snapshot?.reservations.overduePending ?? "..."}
        </div>
      </section>

      <section aria-labelledby="signals-title" className="mt-10">
        <h2 id="signals-title" className="text-xl font-semibold">Simulate a condition</h2>
        <p className="mt-1 text-sm text-neutral-500">These buttons emit one controlled response. They never change business data or stop infrastructure.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <article key={scenario.signal} className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{scenario.label}</h3>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs">HTTP {scenario.expected}</span>
              </div>
              <p className="mt-2 min-h-10 text-sm text-neutral-600">{scenario.detail}</p>
              <button
                type="button"
                disabled={simulation.isPending}
                onClick={() => simulation.mutate({ signal: scenario.signal, expected: scenario.expected })}
                className="mt-5 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Run signal
              </button>
            </article>
          ))}
        </div>
        <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{result}</div>
      </section>
    </div>
  );
}
