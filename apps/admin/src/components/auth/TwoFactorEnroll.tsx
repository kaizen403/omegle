"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2, Copy, Check } from "lucide-react";

interface TwoFactorEnrollProps {
  totpURI: string | null;
  backupCodes: string[];
  onStart: (password: string) => Promise<{ success: boolean; error?: string }>;
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

function totpSecretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") || "";
  } catch {
    const match = uri.match(/[?&]secret=([^&]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  }
}

export function TwoFactorEnroll({
  totpURI,
  backupCodes,
  onStart,
  onVerify,
  onCancel,
}: TwoFactorEnrollProps) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"secret" | "codes" | null>(null);

  const secret = totpURI ? totpSecretFromUri(totpURI) : "";

  useEffect(() => {
    if (!totpURI) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(totpURI, {
      width: 220,
      margin: 1,
      color: { dark: "#09090b", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [totpURI]);

  const copy = async (label: "secret" | "codes", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Enter your password to set up the authenticator");
      return;
    }
    setIsStarting(true);
    setError("");
    const result = await onStart(password);
    setIsStarting(false);
    if (!result.success) {
      setError(result.error || "Could not start authenticator setup");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }
    setIsVerifying(true);
    setError("");
    const result = await onVerify(code);
    if (!result.success) {
      setError(result.error || "Verification failed. Please try again.");
      setCode("");
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-[#0084d1] mb-4">
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
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">
          Set up authenticator
        </h3>
        <p className="text-sm text-slate-500">
          {totpURI
            ? "Scan the QR code, then enter the 6-digit code to finish."
            : "Confirm your password to generate an authenticator key."}
        </p>
      </div>

      {!totpURI ? (
        <form onSubmit={handleStart} className="space-y-4">
          <Input
            type="password"
            placeholder="Account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-14 bg-white border-sky-200 text-slate-900 placeholder:text-slate-400"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={isStarting}
            className="w-full h-14 bg-gradient-to-r from-sky-500 to-[#0084d1] text-white"
          >
            {isStarting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Generate QR code"
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          <div className="flex justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Authenticator QR code"
                className="rounded-lg border border-sky-200 bg-white p-2"
                width={220}
                height={220}
              />
            ) : (
              <div className="h-[220px] w-[220px] rounded-lg bg-sky-50 animate-pulse" />
            )}
          </div>

          {secret && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">
                Or enter this key manually
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={secret}
                  className="font-mono text-xs bg-sky-50 border-sky-200 text-slate-900"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copy("secret", secret)}
                  className="shrink-0 border-sky-200"
                >
                  {copied === "secret" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {backupCodes.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">
                  Save these backup codes
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copy("codes", backupCodes.join("\n"))}
                  className="h-8 text-slate-500"
                >
                  {copied === "codes" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="font-mono text-[11px] leading-5 text-slate-500 break-all">
                {backupCodes.join("  ")}
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isVerifying}
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="w-12 h-14 text-xl font-mono bg-sky-50 border-sky-200 text-slate-900"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <Button
            type="submit"
            disabled={isVerifying}
            className="w-full h-14 bg-gradient-to-r from-sky-500 to-[#0084d1] text-white"
          >
            {isVerifying ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Confirm and continue"
            )}
          </Button>
        </form>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isStarting || isVerifying}
        className="w-full h-12 bg-white border-sky-200 text-slate-700"
      >
        Cancel
      </Button>
    </div>
  );
}
