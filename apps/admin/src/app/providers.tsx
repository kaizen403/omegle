"use client";

import { AuthProvider } from "@/contexts/AuthProvider";
import { AdminSocketProvider } from "@/contexts/AdminSocketContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminSocketProvider>{children}</AdminSocketProvider>
    </AuthProvider>
  );
}
