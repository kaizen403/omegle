"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { MagicCard } from "@/components/ui/magic-card";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface TwoFactorVerificationProps {
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export function TwoFactorVerification({
  onVerify,
  onCancel,
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await onVerify(code);

      if (!result.success) {
        setError(result.error || "Verification failed. Please try again.");
        setCode("");
        setIsLoading(false);
      }
      // On success the component unmounts as the router navigates
    } catch {
      setError("Verification failed. Please try again.");
      setCode("");
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 relative"
    >
      <MagicCard
        className="absolute inset-0 rounded-2xl pointer-events-none"
        gradientSize={300}
        gradientFrom="#3b82f6"
        gradientTo="#8b5cf6"
        gradientOpacity={0.3}
      />
      <div className="text-center relative z-10">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
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
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </motion.div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">
          Two-Factor Authentication
        </h3>
        <p className="text-sm text-slate-500">
          Enter the 6-digit code from your
          <br />
          <span className="text-slate-800 font-medium">authenticator app</span>
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-5 relative z-10">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            disabled={isLoading}
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot
                index={0}
                className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
              />
              <InputOTPSlot
                index={1}
                className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
              />
              <InputOTPSlot
                index={2}
                className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
              />
              <InputOTPSlot
                index={3}
                className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
              />
              <InputOTPSlot
                index={4}
                className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
              />
              <InputOTPSlot
                index={5}
                className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
              />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
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
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        <div className="space-y-3">
          {isLoading ? (
            <Button
              type="submit"
              disabled
              className="w-full h-14 bg-gradient-to-r from-sky-500 to-[#0084d1] text-white font-bold text-base disabled:opacity-70"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
            </Button>
          ) : (
            <InteractiveHoverButton
              type="submit"
              className="w-full h-14 bg-gradient-to-r from-sky-500 to-[#0084d1] hover:from-blue-700 hover:to-blue-800 text-white text-base border-blue-600"
            >
              Verify Code
            </InteractiveHoverButton>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full h-12 bg-white border-sky-200 hover:border-sky-300 hover:bg-sky-50 text-slate-700 disabled:opacity-50"
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="text-center">
        <p className="text-xs text-slate-500">
          Open your authenticator app to get the current code.
        </p>
      </div>
    </motion.div>
  );
}
