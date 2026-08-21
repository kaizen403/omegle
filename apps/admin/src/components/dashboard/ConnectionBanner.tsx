"use client";

interface ConnectionBannerProps {
  isConnected: boolean;
}

export function ConnectionBanner({ isConnected }: ConnectionBannerProps) {
  if (isConnected) return null;

  return (
    <div className="mb-4 p-3 sm:p-4 bg-red-900/20 border border-red-900/50 rounded-lg">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
        <div>
          <div className="font-semibold text-red-400 text-sm sm:text-base">
            Connection Lost
          </div>
          <div className="text-xs sm:text-sm text-zinc-400">
            Attempting to reconnect...
          </div>
        </div>
      </div>
    </div>
  );
}
