"use client";

interface ConnectionBannerProps {
  isConnected: boolean;
}

export function ConnectionBanner({ isConnected }: ConnectionBannerProps) {
  if (isConnected) return null;

  return (
    <div className="min-w-0 rounded-xl border border-danger-line bg-danger-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-sm font-semibold text-danger">Connection lost</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Attempting to reconnect. Numbers on this page are frozen until the
        socket comes back.
      </p>
    </div>
  );
}
