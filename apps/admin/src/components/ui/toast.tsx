"use client";

import { AnimatePresence, motion } from "framer-motion";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const variantStyles: Record<
  ToastVariant,
  { container: string; dot: string; title: string }
> = {
  success: {
    container: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    dot: "bg-emerald-500",
    title: "text-emerald-700",
  },
  error: {
    container: "border-red-200 bg-gradient-to-br from-red-50 to-white",
    dot: "bg-red-500",
    title: "text-red-700",
  },
  warning: {
    container: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
    dot: "bg-amber-500",
    title: "text-amber-700",
  },
  info: {
    container: "border-sky-100 bg-gradient-to-br from-sky-50 to-white",
    dot: "bg-sky-500",
    title: "text-sky-700",
  },
};

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

/**
 * Presentational toast stack. State lives in `ToastProvider`; this component
 * only renders. Rendered once at the root so any page (and the socket hook,
 * which has no DOM of its own) can raise a notification.
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      // `pointer-events-none` on the stack so the fixed overlay never blocks
      // clicks on the dashboard; each toast re-enables them for itself.
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const styles = variantStyles[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              role={
                toast.variant === "error" || toast.variant === "warning"
                  ? "alert"
                  : "status"
              }
              className={`pointer-events-auto rounded-lg border p-3 shadow-md ${styles.container}`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${styles.dot}`}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${styles.title}`}>
                    {toast.title}
                  </div>
                  {toast.description && (
                    <div className="mt-0.5 break-words text-xs text-slate-500">
                      {toast.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 -mt-1 flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-600"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
