export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="py-16 text-center text-sm text-neutral-500">{label}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-16 text-center text-sm text-neutral-500">{message}</p>;
}
