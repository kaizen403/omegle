"use client";

interface ErrorBannerProps {
  error: string;
}

export default function ErrorBanner({ error }: ErrorBannerProps) {
  return (
    <div className="rounded-xl border border-danger-line bg-danger-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-danger">Something went wrong</p>
        <p className="mt-0.5 text-sm break-words text-danger/80">{error}</p>
      </div>
    </div>
  );
}
