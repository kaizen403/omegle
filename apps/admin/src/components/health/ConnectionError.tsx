"use client";

interface ConnectionErrorProps {
  error: string;
}

export function ConnectionError({ error }: ConnectionErrorProps) {
  return (
    <div className="min-w-0 rounded-xl border border-danger-line bg-danger-surface px-4 py-3.5">
      <p className="text-sm font-semibold text-danger">Connection error</p>
      <p className="mt-0.5 text-sm break-words text-danger/90">{error}</p>
    </div>
  );
}
