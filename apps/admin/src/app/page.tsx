"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "@/contexts/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TwoFactorVerification } from "@/components/auth/TwoFactorVerification";
import { TwoFactorEnroll } from "@/components/auth/TwoFactorEnroll";
import { Loader2, Mail, Lock } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPasswordInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const router = useRouter();
  const {
    login,
    isLoading,
    verifyMfaAndLogin,
    needsMfaEnroll,
    mfaEnroll,
    beginMfaEnroll,
    verifyMfaEnroll,
    cancelMfaEnroll,
  } = useAuth();

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

    if (!email.trim()) {
      setErrorMessage("Please enter your email");
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

    const result = await login(email, password, turnstileToken || undefined);

    setIsSubmitting(false);

    if (result.success) {
      router.push("/home");
    } else if (result.requiresMfaEnroll) {
      setShowMfa(false);
      setErrorMessage("");
    } else if (result.requiresMfa) {
      // Show TOTP verification step
      setShowMfa(true);
    } else {
      setErrorMessage(result.error || "Invalid email or password");
      // Turnstile tokens are single-use
      resetTurnstile();
    }
  };

  const handleMfaVerify = async (code: string) => {
    const result = await verifyMfaAndLogin(code);
    if (result.success) {
      router.push("/home");
    }
    return result;
  };

  const handleMfaCancel = () => {
    setShowMfa(false);
    setErrorMessage("Login cancelled");
    resetTurnstile();
  };

  const busy = isLoading || isSubmitting;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sky-500/40">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-400 to-cyan-400 animate-gradient-xy" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_50%)] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.45),_transparent_55%)] opacity-70" />
      </div>
      <div className="absolute top-20 left-10 sm:left-20 w-60 sm:w-72 h-60 sm:h-72 bg-sky-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
      <div className="absolute top-44 right-4 sm:right-20 w-56 sm:w-72 h-56 sm:h-72 bg-blue-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-10 left-20 sm:left-40 w-64 sm:w-72 h-64 sm:h-72 bg-cyan-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4 space-y-6 sm:space-y-8 bg-white/95 p-6 sm:p-10 backdrop-blur-xl rounded-2xl border border-white/70 shadow-xl"
      >
        {needsMfaEnroll ? (
          <TwoFactorEnroll
            totpURI={mfaEnroll?.totpURI ?? null}
            backupCodes={mfaEnroll?.backupCodes ?? []}
            onStart={beginMfaEnroll}
            onVerify={async (code) => {
              const result = await verifyMfaEnroll(code);
              if (result.success) {
                router.push("/home");
              }
              return result;
            }}
            onCancel={() => {
              void cancelMfaEnroll();
              setErrorMessage("Authenticator setup cancelled");
              resetTurnstile();
            }}
          />
        ) : showMfa ? (
          <TwoFactorVerification
            onVerify={handleMfaVerify}
            onCancel={handleMfaCancel}
          />
        ) : (
          <>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-[#0084d1] mb-4"
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent"
              >
                Welcome Back
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-2 text-sm text-slate-500"
              >
                Sign in to access the admin dashboard
              </motion.p>
            </div>

            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onSubmit={handleSubmit}
              className="mt-6 sm:mt-8 space-y-4 sm:space-y-6"
            >
              <div className="space-y-4 sm:space-y-5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email Address"
                    autoComplete="email"
                    className="h-14 pl-11 bg-sky-50 border-sky-200 hover:border-sky-300 focus:border-[#0084d1] text-slate-900 placeholder:text-slate-400 text-base"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    aria-label="Password"
                    autoComplete="current-password"
                    className="h-14 pl-11 bg-sky-50 border-sky-200 hover:border-sky-300 focus:border-[#0084d1] text-slate-900 placeholder:text-slate-400 text-base"
                  />
                </div>

                {TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center">
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
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <svg
                      className="w-5 h-5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-red-400">{errorMessage}</p>
                  </motion.div>
                )}
              </div>

              {busy ? (
                <Button
                  type="submit"
                  disabled
                  className="w-full h-14 bg-gradient-to-r from-sky-500 to-[#0084d1] text-white font-bold text-base disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-14 bg-gradient-to-r from-sky-500 to-[#0084d1] hover:from-[#0084d1] hover:to-sky-700 text-white text-base font-semibold"
                >
                  Sign In
                </Button>
              )}
            </motion.form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center space-y-2"
            >
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>Authorized personnel only</span>
              </div>
              <p className="text-xs text-slate-400">
                Protected by enterprise security
              </p>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
