"use client";

import { useAuth } from "@/contexts/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, admin } = useAuth();
  const router = useRouter();
  const wasAuthenticatedRef = useRef(false);

  // Track authenticated state and redirect if not authenticated
  useEffect(() => {
    // Track if user was ever authenticated in this session
    if (isAuthenticated && admin) {
      wasAuthenticatedRef.current = true;
    }

    // Redirect to login if not authenticated (after loading completes)
    if (!isLoading && (!isAuthenticated || !admin)) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, admin, router]);

  // Show loading state while checking authentication
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

  // Strict security: Don't render protected content if not fully authenticated
  if (!isAuthenticated || !admin) {
    return null;
  }

  return <>{children}</>;
}
