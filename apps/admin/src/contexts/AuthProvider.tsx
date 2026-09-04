"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { securityLogger } from "@/lib/security/securityLogger";
import { useSecurityMonitor } from "@/hooks/useSecurityMonitor";
import { storage, STORAGE_KEYS } from "@/lib/storage";

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: Admin | null;
  token: string | null;
  login: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// Periodic session refresh (keeps the Better Auth session cookie fresh)
const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Verify the current Better Auth session cookie with the backend and
 * return the admin profile. The backend reads the session cookie
 * (credentials: 'include') — no Bearer tokens.
 */
async function verifyAdminSession(
  signal?: AbortSignal,
): Promise<
  | { ok: true; admin: Admin; mfaEnabled: boolean }
  | { ok: false; message?: string }
> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/verify`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { ok: false, message: data.message };
    }

    const data = await response.json();

    if (!data?.data?.admin?.id || !data?.data?.admin?.email) {
      return {
        ok: false,
        message: "Invalid server response. Please contact support.",
      };
    }

    return {
      ok: true,
      admin: {
        id: data.data.admin.id,
        email: data.data.admin.email,
        name: data.data.admin.name,
        role: data.data.admin.role,
      },
      mfaEnabled: Boolean(data.data.admin.mfaEnabled),
    };
  } catch {
    return { ok: false };
  }
}

function mapAuthError(error: { code?: string; message?: string }): string {
  const code = error.code || "";

  if (
    code.includes("INVALID_EMAIL_OR_PASSWORD") ||
    code.includes("INVALID_CREDENTIALS") ||
    code.includes("USER_NOT_FOUND") ||
    code.includes("INVALID_PASSWORD")
  ) {
    return "Invalid email or password";
  }
  if (code.includes("RATE_LIMIT") || code.includes("TOO_MANY")) {
    return "Too many login attempts. Please try again later.";
  }
  if (code.includes("USER_DISABLED") || code.includes("BANNED")) {
    return "This account has been disabled. Please contact support.";
  }
  if (code.includes("EMAIL_NOT_VERIFIED")) {
    return "Please verify your email before signing in.";
  }
  if (code.includes("NETWORK") || code.includes("FETCH")) {
    return "Network error. Please check your connection and try again.";
  }
  if (code.includes("INVALID_EMAIL")) {
    return "Please enter a valid email address.";
  }
  if (code.includes("CAPTCHA") || code.includes("TURNSTILE")) {
    return "Security check failed. Please try again.";
  }

  return "Unable to sign in. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  const pendingPasswordRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = admin !== null;

  // Security monitoring
  useSecurityMonitor({
    detectDevTools: true,
    monitorTabVisibility: true,
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    onSecurityEvent: (event) => {
      if (event === "inactivity_timeout" && admin) {
        // Force logout on prolonged inactivity
        void authClient.signOut();
        setAdmin(null);
        setToken(null);
        storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
        storage.remove(STORAGE_KEYS.ADMIN_USER);
        window.dispatchEvent(new Event("adminTokenChanged"));
        router.replace("/");
      }
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Restore session on mount: Better Auth session cookie + backend admin check
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const { data } = await authClient.getSession();

        if (cancelled || !isMountedRef.current) return;

        if (!data?.session) {
          setAdmin(null);
          setToken(null);
          storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
          setIsLoading(false);
          return;
        }

        const sessionToken = data.session.token;
        const verification = await verifyAdminSession();

        if (cancelled || !isMountedRef.current) return;

        if (verification.ok) {
          // TOTP removed: an active admin session is admitted on its own.
          setAdmin(verification.admin);
          setToken(sessionToken);
          storage.set(STORAGE_KEYS.ADMIN_TOKEN, sessionToken);
          window.dispatchEvent(new Event("adminTokenChanged"));
        } else {
          // Session exists but is not an active admin
          await authClient.signOut();
          setAdmin(null);
          setToken(null);
          storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
        }
      } catch {
        if (!cancelled && isMountedRef.current) {
          setAdmin(null);
          setToken(null);
          storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  // Periodic session refresh — Better Auth extends the session cookie on read
  useEffect(() => {
    if (!admin) return;

    let isCancelled = false;

    const refreshInterval = setInterval(async () => {
      if (isCancelled || !isMountedRef.current) return;

      try {
        const { data } = await authClient.getSession();

        if (isCancelled || !isMountedRef.current) return;

        if (!data?.session) {
          // Session expired or was revoked server-side
          securityLogger.logTokenExpired();
          setAdmin(null);
          setToken(null);
          storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
          storage.remove(STORAGE_KEYS.ADMIN_USER);
          window.dispatchEvent(new Event("adminTokenChanged"));
          return;
        }

        if (data.session.token !== token) {
          setToken(data.session.token);
          storage.set(STORAGE_KEYS.ADMIN_TOKEN, data.session.token);
          window.dispatchEvent(new Event("adminTokenChanged"));
        }
      } catch {
        // Keep the current session on transient refresh errors
      }
    }, SESSION_REFRESH_INTERVAL);

    return () => {
      isCancelled = true;
      clearInterval(refreshInterval);
    };
  }, [admin, token]);

  // Handle routing after authentication check
  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute = pathname !== "/";

    if (!isAuthenticated && isProtectedRoute) {
      router.replace("/");
    } else if (isAuthenticated && pathname === "/") {
      router.replace("/home");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Complete login after a Better Auth session is established:
  // verify admin role/isActive with the backend using the session cookie.
  const completeLogin = useCallback(
    async (email?: string): Promise<LoginResult> => {
      const { data: sessionData } = await authClient.getSession();

      if (!sessionData?.session) {
        return {
          success: false,
          error: "Unable to establish session. Please try again.",
        };
      }

      const verification = await verifyAdminSession();

      if (!verification.ok) {
        pendingPasswordRef.current = null;
        await authClient.signOut();
        return {
          success: false,
          error:
            verification.message ||
            "Access denied. You are not authorized as an admin.",
        };
      }

      // TOTP removed: a verified admin goes straight in after email + password.
      pendingPasswordRef.current = null;

      if (isMountedRef.current) {
        setAdmin(verification.admin);
        setToken(sessionData.session.token);
        storage.set(STORAGE_KEYS.ADMIN_TOKEN, sessionData.session.token);
      }

      if (email) {
        securityLogger.logLoginSuccess(email);
      }

      window.dispatchEvent(new Event("adminTokenChanged"));

      return { success: true };
    },
    [],
  );

  // Login using Better Auth email + password (Turnstile token attached)
  const login = useCallback(
    async (
      email: string,
      password: string,
      captchaToken?: string,
    ): Promise<LoginResult> => {
      try {
        pendingPasswordRef.current = password;
        const { error } = await authClient.signIn.email(
          {
            email,
            password,
            ...(captchaToken ? { captchaResponse: captchaToken } : {}),
          },
          captchaToken
            ? { headers: { "x-captcha-response": captchaToken } }
            : undefined,
        );

        if (error) {
          pendingPasswordRef.current = null;
          securityLogger.logLoginFailure(email, error.code || "unknown_error");
          return { success: false, error: mapAuthError(error) };
        }

        return await completeLogin(email);
      } catch (error: unknown) {
        pendingPasswordRef.current = null;
        const authError = error as { code?: string; message?: string };
        securityLogger.logLoginFailure(
          email,
          authError.code || "unknown_error",
        );
        return { success: false, error: mapAuthError(authError) };
      }
    },
    [completeLogin],
  );

  // Logout: clear Better Auth session (server clears the cookie) + local state
  const logout = useCallback(async () => {
    try {
      const userEmail = admin?.email;

      // Revoke the server session while the cookie is still present,
      // then clear the client. Sign-out-first would 401 /api/admin/logout.
      try {
        await fetch(`${BACKEND_URL}/api/admin/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch {
        // Ignore backend logout errors
      }

      await authClient.signOut();

      if (isMountedRef.current) {
        setAdmin(null);
        setToken(null);
      }
      storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
      storage.remove(STORAGE_KEYS.ADMIN_USER);

      securityLogger.logLogout(userEmail);

      // Dispatch event for socket to disconnect
      window.dispatchEvent(new Event("adminTokenChanged"));
      router.push("/");
    } catch {
      // Logout failed silently
    }
  }, [admin, router]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        admin,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
