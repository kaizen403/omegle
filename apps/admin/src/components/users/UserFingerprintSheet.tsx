"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from "@/types/socket";
import { FingerprintCard } from "@/components/rooms/monitor/FingerprintCard";

interface Props {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFingerprintSheet({ user, open, onOpenChange }: Props) {
  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fingerprint — {user.name}{" "}
            <span className="font-mono text-xs text-slate-500">
              #{user.uid}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <FingerprintCard
            title="Device fingerprint"
            fp={
              (
                user as unknown as {
                  fingerprint?: import("@/types/socket").UserFingerprint | null;
                }
              ).fingerprint ?? null
            }
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <div className="font-semibold text-slate-800">Stored in DB</div>
            <p className="mt-1">
              Table <span className="font-mono">user_fingerprints</span> —
              unique on <span className="font-mono">hash</span>, with{" "}
              <span className="font-mono">linked_uids jsonb</span>,{" "}
              <span className="font-mono">seen_count</span>,{" "}
              <span className="font-mono">risk_score</span>,{" "}
              <span className="font-mono">first_seen_at / last_seen_at</span>.
              Listed under “Fingerprints” tab when the web app is wired.
            </p>
            {user.fingerprintHash && (
              <p className="mt-1 font-mono text-xs text-slate-600">
                hash: {user.fingerprintHash}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
