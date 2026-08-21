"use client";

interface ExportSuccessIndicatorProps {
  show: boolean;
}

export function ExportSuccessIndicator({ show }: ExportSuccessIndicatorProps) {
  if (!show) return null;

  return (
    <div className="flex items-center gap-1.5 bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-700/50">
      <svg
        className="w-3.5 h-3.5 text-green-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span className="text-xs text-green-400 font-medium">Exported!</span>
    </div>
  );
}
