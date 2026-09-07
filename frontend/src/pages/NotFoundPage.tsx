import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      <p className="text-sm text-neutral-500">Page not found.</p>
      <Link to="/" className="mt-2 inline-block text-sm font-medium text-neutral-900">
        ← Back to events
      </Link>
    </div>
  );
}
