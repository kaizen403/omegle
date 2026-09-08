"use client";

import { useAuth } from "@/contexts/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function HomeAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, admin } = useAuth();
  const router = useRouter();
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && admin) {
      wasAuthenticatedRef.current = true;
    }

    if (!isLoading && (!isAuthenticated || !admin)) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, admin, router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="size-7 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">Checking your session</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null;
  }

  return <>{children}</>;
}
