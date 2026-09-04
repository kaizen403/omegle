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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#e8f4f8]">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-[#0084d1] border-r-transparent"></div>
          <p className="mt-4 text-slate-500 text-lg">
            Verifying credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null;
  }

  return <>{children}</>;
}
