"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IdChip } from "@/components/console";
import type { User, UserFingerprint } from "@/types/socket";
import { FingerprintCard } from "@/components/rooms/monitor/FingerprintCard";

interface Props {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFingerprintSheet({ user, open, onOpenChange }: Props) {
  if (!user) return null;

  const fingerprint: UserFingerprint | null = user.fingerprint ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate">Fingerprint — {user.name}</span>
            <IdChip value={user.uid} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <FingerprintCard title="Device fingerprint" fp={fingerprint} />

          <div className="rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-medium text-foreground">
              Stored in the database
            </p>
            <p className="mt-1">
              Table <span className="font-mono">user_fingerprints</span> —
              unique on <span className="font-mono">hash</span>, with{" "}
              <span className="font-mono">linked_uids jsonb</span>,{" "}
              <span className="font-mono">seen_count</span>,{" "}
              <span className="font-mono">risk_score</span> and{" "}
              <span className="font-mono">first_seen_at / last_seen_at</span>.
              It appears under the fingerprints tab once the web app is wired
              up.
            </p>
            {user.fingerprintHash && (
              <p className="mt-2 flex min-w-0 items-center gap-1.5">
                <span className="shrink-0">Hash</span>
                <IdChip
                  value={user.fingerprintHash}
                  prefix=""
                  className="min-w-0"
                />
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
