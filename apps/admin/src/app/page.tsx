"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "@/contexts/AuthProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, User, Lock, AlertCircle, ShieldCheck } from "lucide-react";

/**
 * Turnstile site key.
 *
 * A site key is public by construction — it ships inside this bundle for the widget to read,
 * and is inert without the secret key, which lives in SSM and never leaves the API. So the
 * real value is the default rather than a placeholder, and the env var only overrides it.
 *
 * It is not left to the environment alone because this is a build-time NEXT_PUBLIC_* value
 * and every way of supplying it has already failed once: CI read it from a GitHub *variable*
 * when it was stored as a secret, and .env.local (which outranks .env.production, and which
 * .gitignore keeps out of the repo) sets it to the empty string. Either way the widget
 * rendered with an empty siteKey, never produced a token, and every sign-in came back as
 * "Unable to sign in. Please try again." A build from a clean checkout now matches what
 * production runs.
 */
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAEmaAWD98EH-DebI";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPasswordInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const router = useRouter();
  const { login, isLoading } = useAuth();

  // Clear session revoked flag on login page
  useEffect(() => {
    localStorage.removeItem("sessionRevoked");
  }, []);

  const resetTurnstile = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      setErrorMessage("Please enter your username");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please enter your password");
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMessage("Please complete the security check");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    const result = await login(
      identifier,
      password,
      turnstileToken || undefined,
    );

    setIsSubmitting(false);

    if (result.success) {
      router.push("/home");
    } else {
      setErrorMessage(result.error || "Invalid username or password");
      // Turnstile tokens are single-use
      resetTurnstile();
    }
  };

  const busy = isLoading || isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            <Lock className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">
              Omegle VITAP
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Admin console
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your admin credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Username</Label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  aria-label="Username"
                  autoComplete="username"
                  className="h-10 pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  aria-label="Password"
                  autoComplete="current-password"
                  className="h-10 pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </div>
            </div>

            {TURNSTILE_SITE_KEY && (
              <div className="flex min-h-[65px] justify-center overflow-hidden">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  options={{ theme: "light" }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                  onTimeout={() => setTurnstileToken(null)}
                />
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-surface p-3"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-danger"
                  strokeWidth={2}
                />
                <p className="min-w-0 text-sm text-danger">{errorMessage}</p>
              </div>
            )}

            <Button type="submit" disabled={busy} className="h-10 w-full">
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  <span>Signing in</span>
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" strokeWidth={2} />
          <span className="truncate">Authorized personnel only</span>
        </div>
      </motion.div>
    </div>
  );
}
