"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ToastViewport,
  type ToastMessage,
  type ToastVariant,
} from "@/components/ui/toast";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Pass 0 to require a manual dismiss. */
  duration?: number;
}

/**
 * Only the stable action functions are exposed through context. The toast list
 * itself is passed straight to the viewport, so raising a toast does not
 * invalidate the context and re-render the whole dashboard.
 */
interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
}

// Older notifications are dropped rather than stacking off-screen.
const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATION_MS = 5000;
// Failures linger: an admin who kicked a user and looked away still needs to
// see that it did not work.
const FAILURE_DURATION_MS = 8000;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // `toast` must keep a stable identity: socket listeners in useAdminSocket are
  // registered once per connection and close over it.
  const toast = useCallback(
    ({ title, description, variant = "info", duration }: ToastOptions) => {
      const id = nextIdRef.current++;
      const ttl =
        duration ??
        (variant === "error" || variant === "warning"
          ? FAILURE_DURATION_MS
          : DEFAULT_DURATION_MS);

      setToasts((prev) =>
        [...prev, { id, title, description, variant }].slice(
          -MAX_VISIBLE_TOASTS,
        ),
      );

      if (ttl > 0) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), ttl),
        );
      }
    },
    [dismiss],
  );

  // Clear pending timers so a late auto-dismiss cannot setState after unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
