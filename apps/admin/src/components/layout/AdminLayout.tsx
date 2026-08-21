"use client";

import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionRevokedOverlay } from "./SessionRevokedOverlay";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";

interface AdminLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

export default function AdminLayout({ children, onLogout }: AdminLayoutProps) {
  const { error } = useAdminSocketContext();

  // Check localStorage for session revoked flag
  const [localStorageRevoked, setLocalStorageRevoked] = useState(false);

  // Check localStorage only on mount
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("sessionRevoked") === "true"
    ) {
      setLocalStorageRevoked(true);
    }
  }, []);

  const showRevokedOverlay = error === "session_revoked" || localStorageRevoked;

  // Prevent back navigation when session is revoked
  useEffect(() => {
    if (showRevokedOverlay) {
      const preventBack = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
      };

      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", preventBack);

      return () => {
        window.removeEventListener("popstate", preventBack);
      };
    }
  }, [showRevokedOverlay]);

  return (
    <SidebarProvider>
      <AppSidebar onLogout={onLogout} />
      <SidebarInset>
        <div className="flex h-full flex-col">{children}</div>
      </SidebarInset>
      {showRevokedOverlay && <SessionRevokedOverlay onLogout={onLogout} />}
    </SidebarProvider>
  );
}
