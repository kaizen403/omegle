"use client";

import { AuthProvider } from "@/contexts/AuthProvider";
import { AdminSocketProvider } from "@/contexts/AdminSocketContext";
import { ToastProvider } from "@/contexts/ToastProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* ToastProvider wraps AdminSocketProvider: the socket hook raises
          toasts for admin-action acknowledgements, so it needs the context. */}
      <ToastProvider>
        <AdminSocketProvider>{children}</AdminSocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
