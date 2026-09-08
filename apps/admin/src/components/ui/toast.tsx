"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/components/console";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

/** Variants map onto the console's semantic tones — no bespoke colours here. */
const VARIANTS: Record<ToastVariant, { tone: Tone; icon: LucideIcon }> = {
  success: { tone: "success", icon: CheckCircle2 },
  error: { tone: "danger", icon: XCircle },
  warning: { tone: "warning", icon: AlertTriangle },
  info: { tone: "info", icon: Info },
};

const ICON_TONE: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-neutral",
};

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

/**
 * Presentational toast stack. State lives in `ToastProvider`; this component
 * only renders. Rendered once at the root so any page (and the socket hook,
 * which has no DOM of its own) can raise a notification.
 *
 * Toasts sit on a plain card surface with a tinted icon rather than a tinted
 * gradient panel: at the bottom-right of a busy console, a coloured slab reads
 * as an error even when it is a success.
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      // `pointer-events-none` on the stack so the fixed overlay never blocks
      // clicks on the dashboard; each toast re-enables them for itself.
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const { tone, icon: Icon } = VARIANTS[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.16 }}
              role={
                toast.variant === "error" || toast.variant === "warning"
                  ? "alert"
                  : "status"
              }
              className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 shadow-[0_8px_24px_rgba(16,24,40,0.10)]"
            >
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${ICON_TONE[tone]}`}
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="mt-0.5 text-xs break-words text-muted-foreground">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mt-0.5 -mr-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
